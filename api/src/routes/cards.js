const express = require('express');
const mongoose = require('mongoose');
const Card = require('../models/Card');
const { requireAdmin } = require('../middleware/adminAuth');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { haeHinta } = require('../services/tcgdex');
const { kasitteleKorttikuva } = require('../services/korttikuva');

const router = express.Router();

// Ylläpidosta ladatut kuvat: KUVAT_DIR (oletus api/lataukset), tarjoillaan osoitteessa /lataukset
const KUVAT_DIR = process.env.KUVAT_DIR || path.join(__dirname, '..', '..', 'lataukset');
const LATAUS_URL = '/lataukset/';
const lataus = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Poistaa aiemmin ladatun kuvan levyltä (valmiiksi mukana olevia /kortit-kuvia ei poisteta)
async function poistaLadattuKuva(omaKuva) {
  if (!omaKuva || !omaKuva.startsWith(LATAUS_URL)) return;
  const nimi = path.basename(omaKuva);
  await Promise.all([nimi, nimi.replace(/\.webp$/, '-pieni.webp')].map((n) =>
    fs.rm(path.join(KUVAT_DIR, n), { force: true })));
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/cards
// Query params: kategoria, search, sort (nimi|arvo|kategoria|kunto), order (asc|desc), myyty (true|false)
router.get('/', async (req, res) => {
  try {
    const { kategoria, search, sort = 'arvo', order = 'desc', myyty } = req.query;
    const filter = {};

    if (kategoria && kategoria !== 'Kaikki') {
      filter.kategoria = kategoria;
    }
    if (myyty === 'true') filter['myyty.tila'] = true;
    if (myyty === 'false') filter['myyty.tila'] = { $ne: true };
    if (search) {
      filter.$or = [
        { nimi: { $regex: search, $options: 'i' } },
        { numero: { $regex: search, $options: 'i' } },
      ];
    }

    const sortableFields = ['nimi', 'arvo', 'kategoria', 'kunto', 'lisatty'];
    const sortField = sortableFields.includes(sort) ? sort : 'arvo';
    const sortOrder = order === 'asc' ? 1 : -1;

    const cards = await Card.find(filter).sort({ [sortField]: sortOrder });
    res.json(cards);
  } catch (err) {
    res.status(500).json({ virhe: 'Korttien haku epäonnistui', details: err.message });
  }
});

// GET /api/cards/stats  -- kokonaisarvo ja lukumäärä kategorioittain
router.get('/stats', async (req, res) => {
  try {
    const byCategory = await Card.aggregate([
      { $match: { 'myyty.tila': { $ne: true } } },
      {
        $group: {
          _id: '$kategoria',
          lkm: { $sum: 1 },
          yhteisarvo: { $sum: '$arvo' },
        },
      },
      { $sort: { yhteisarvo: -1 } },
    ]);

    const totalAgg = await Card.aggregate([
      { $match: { 'myyty.tila': { $ne: true } } },
      { $group: { _id: null, yhteisarvo: { $sum: '$arvo' }, lkm: { $sum: 1 } } },
    ]);

    const soldCount = await Card.countDocuments({ 'myyty.tila': true });

    res.json({
      kategoriat: byCategory.map((c) => ({ kategoria: c._id, lkm: c.lkm, yhteisarvo: Math.round(c.yhteisarvo * 100) / 100 })),
      yhteensa: {
        lkm: totalAgg[0]?.lkm || 0,
        yhteisarvo: Math.round((totalAgg[0]?.yhteisarvo || 0) * 100) / 100,
      },
      myyty: soldCount,
    });
  } catch (err) {
    res.status(500).json({ virhe: 'Tilastojen haku epäonnistui', details: err.message });
  }
});

// GET /api/cards/:id
router.get('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ virhe: 'Virheellinen id' });
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ virhe: 'Korttia ei löytynyt' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ virhe: 'Kortin haku epäonnistui', details: err.message });
  }
});

// POST /api/cards  (YLLAPITO)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nimi, numero, kategoria, kunto, arvo, kuva, omaKuva } = req.body;
    const card = new Card({ nimi, numero, kategoria, kunto, arvo, kuva, omaKuva });
    await card.save();
    res.status(201).json(card);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ virhe: 'Virheellinen data', details: err.message });
    }
    res.status(500).json({ virhe: 'Kortin lisäys epäonnistui', details: err.message });
  }
});

// TCGdexin Cardmarket-tuoteliitokset ovat toisinaan virheellisia/vanhentuneita,
// jolloin haettu hinta voi olla moninkertaisesti liian pieni. Jos uusi hinta on
// alle 30% vanhasta (eika vanha ollut jo mitaton), sita ei ylikirjoiteta
// automaattisesti vaan se jaa ylläpitäjän tarkistettavaksi.
const EPAILYTTAVAN_PUDOTUKSEN_RAJA = 0.3;
const PIENIN_TARKISTETTAVA_VANHA_ARVO = 2;

// POST /api/cards/paivita-hinnat  (YLLAPITO) -- hakee jokaiselle kortille
// tuoreen Cardmarket-hinnan TCGdexista ja tallentaa sen arvo-kenttaan.
// Kategoria "Kiilto" haetaan holo-hintana, muut normaalina.
router.post('/paivita-hinnat', requireAdmin, async (req, res) => {
  try {
    const cards = await Card.find({});
    const tulos = { paivitetty: 0, ei_loytynyt: [], tarkista: [], virhe: [] };

    for (const card of cards) {
      try {
        const haku = await haeHinta({ nimi: card.nimi, numero: card.numero, holo: card.kategoria === 'Kiilto' });
        if (haku.loytyi && haku.paras.kuva && !card.kuva) card.kuva = haku.paras.kuva;
        const arvo = haku.loytyi ? haku.paras.hinta?.arvo : null;
        if (arvo === null || arvo === undefined) {
          if (card.isModified('kuva')) await card.save();
          tulos.ei_loytynyt.push({ id: card._id, nimi: card.nimi, numero: card.numero });
          continue;
        }

        const vanhaArvo = card.arvo;
        const epailyttava = vanhaArvo >= PIENIN_TARKISTETTAVA_VANHA_ARVO && arvo <= vanhaArvo * EPAILYTTAVAN_PUDOTUKSEN_RAJA;
        if (epailyttava) {
          tulos.tarkista.push({ id: card._id, nimi: card.nimi, numero: card.numero, vanha: vanhaArvo, uusi: arvo });
          continue;
        }

        card.arvo = arvo;
        await card.save();
        tulos.paivitetty += 1;
      } catch (err) {
        tulos.virhe.push({ id: card._id, nimi: card.nimi, virhe: err.message });
      }
    }

    res.json(tulos);
  } catch (err) {
    res.status(500).json({ virhe: 'Hintojen paivitys epaonnistui', details: err.message });
  }
});

// PUT /api/cards/:id  (YLLAPITO) -- korvaa muokattavat kentat
router.put('/:id', requireAdmin, async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ virhe: 'Virheellinen id' });
  try {
    const { nimi, numero, kategoria, kunto, arvo, kuva, omaKuva } = req.body;
    const card = await Card.findByIdAndUpdate(
      req.params.id,
      { nimi, numero, kategoria, kunto, arvo, kuva, omaKuva },
      { new: true, runValidators: true }
    );
    if (!card) return res.status(404).json({ virhe: 'Korttia ei löytynyt' });
    res.json(card);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ virhe: 'Virheellinen data', details: err.message });
    }
    res.status(500).json({ virhe: 'Kortin päivitys epäonnistui', details: err.message });
  }
});

// PATCH /api/cards/:id/myyty  (YLLAPITO) -- merkitse myydyksi / palauta myymattomaksi
router.patch('/:id/myyty', requireAdmin, async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ virhe: 'Virheellinen id' });
  try {
    const { tila, hinta, ostaja } = req.body;
    const update = {
      'myyty.tila': !!tila,
      'myyty.pvm': tila ? new Date() : null,
      'myyty.hinta': tila ? (hinta ?? null) : null,
      'myyty.ostaja': tila ? (ostaja || '') : '',
    };
    const card = await Card.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!card) return res.status(404).json({ virhe: 'Korttia ei löytynyt' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ virhe: 'Myyntitilan päivitys epäonnistui', details: err.message });
  }
});

// DELETE /api/cards/:id  (YLLAPITO)
router.delete('/:id', requireAdmin, async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ virhe: 'Virheellinen id' });
  try {
    const card = await Card.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ virhe: 'Korttia ei löytynyt' });
    await poistaLadattuKuva(card.omaKuva).catch((err) => console.warn('[kuva] Poisto epäonnistui:', err.message));
    res.json({ ok: true, poistettu: card._id });
  } catch (err) {
    res.status(500).json({ virhe: 'Kortin poisto epäonnistui', details: err.message });
  }
});

// POST /api/cards/:id/kuva  (YLLAPITO) -- oma valokuva kortista, multipart-kenttä "kuva".
// Kuva rajataan, käännetään ja siitä poistetaan EXIF/GPS ennen tallennusta (services/korttikuva.js).
router.post('/:id/kuva', requireAdmin, lataus.single('kuva'), async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ virhe: 'Virheellinen id' });
  if (!req.file) return res.status(400).json({ virhe: 'Kuvaa ei saatu: valitse kuvatiedosto (jpg, png tai webp)' });
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ virhe: 'Korttia ei löytynyt' });

    let kuvat;
    try {
      kuvat = await kasitteleKorttikuva(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ virhe: 'Kuvaa ei voitu lukea. Kokeile jpg- tai png-kuvaa.', details: err.message });
    }

    // Uusi nimi joka latauksella: selaimen välimuisti ei näytä vanhaa kuvaa
    const nimi = `${slug(card.nimi) || 'kortti'}-${String(card._id).slice(-6)}-${Date.now().toString(36)}`;
    await fs.mkdir(KUVAT_DIR, { recursive: true });
    await fs.writeFile(path.join(KUVAT_DIR, `${nimi}.webp`), kuvat.iso);
    await fs.writeFile(path.join(KUVAT_DIR, `${nimi}-pieni.webp`), kuvat.pieni);

    const vanha = card.omaKuva;
    card.omaKuva = `${LATAUS_URL}${nimi}.webp`;
    await card.save();
    await poistaLadattuKuva(vanha).catch((err) => console.warn('[kuva] Vanhan poisto epäonnistui:', err.message));
    res.json({ kortti: card, rajattu: kuvat.rajattu });
  } catch (err) {
    res.status(500).json({ virhe: 'Kuvan tallennus epäonnistui', details: err.message });
  }
});

// DELETE /api/cards/:id/kuva  (YLLAPITO) -- poistaa oman kuvan; kortille jää TCGdexin kuva
router.delete('/:id/kuva', requireAdmin, async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ virhe: 'Virheellinen id' });
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ virhe: 'Korttia ei löytynyt' });
    const vanha = card.omaKuva;
    card.omaKuva = '';
    await card.save();
    await poistaLadattuKuva(vanha).catch((err) => console.warn('[kuva] Poisto epäonnistui:', err.message));
    res.json(card);
  } catch (err) {
    res.status(500).json({ virhe: 'Kuvan poisto epäonnistui', details: err.message });
  }
});

// Liian iso tiedosto tms. multerin virhe selkokielisenä
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const virhe = err.code === 'LIMIT_FILE_SIZE' ? 'Kuva on liian iso (enintään 20 Mt)' : `Latausvirhe: ${err.message}`;
    return res.status(400).json({ virhe });
  }
  next(err);
});

module.exports = router;
module.exports.KUVAT_DIR = KUVAT_DIR;
