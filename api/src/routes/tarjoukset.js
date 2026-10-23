const express = require('express');
const mongoose = require('mongoose');
const Card = require('../models/Card');
const Tarjous = require('../models/Tarjous');
const { requireAdmin } = require('../middleware/adminAuth');
const { lahetaTarjousIlmoitus, lahetaHyvaksyntaIlmoitus } = require('../services/email');

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// POST /api/cards/:id/tarjous  (JULKINEN — kuka tahansa saa tehdä tarjouksen)
// Luo tarjouksen, merkitsee kortin "tarjottu"-tilaan ja lahettaa
// sahkoposti-ilmoituksen yllapitajalle.
router.post('/cards/:id/tarjous', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ virhe: 'Virheellinen kortin id' });

  try {
    const kortti = await Card.findById(id);
    if (!kortti) return res.status(404).json({ virhe: 'Korttia ei löytynyt' });
    if (kortti.myyty?.tila) return res.status(409).json({ virhe: 'Kortti on jo myyty' });
    if (kortti.tarjottu) return res.status(409).json({ virhe: 'Kortista on jo aktiivinen tarjous käsittelyssä' });

    const { ostajan_nimi, ostajan_sahkoposti, ostajan_viesti, tarjottu_hinta } = req.body;
    const tarjous = new Tarjous({
      kortti_id: kortti._id,
      ostajan_nimi,
      ostajan_sahkoposti,
      ostajan_viesti,
      tarjottu_hinta,
    });
    await tarjous.save();

    kortti.tarjottu = true;
    await kortti.save();

    const emailTulos = await lahetaTarjousIlmoitus({ kortti, tarjous });

    res.status(201).json({
      ok: true,
      tarjous_id: tarjous._id,
      viesti: 'Tarjous vastaanotettu. Myyjä ottaa sinuun yhteyttä jos tarjous hyväksytään.',
      sahkoposti_lahetetty: emailTulos.lahetetty,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ virhe: 'Virheellinen data', details: err.message });
    }
    res.status(500).json({ virhe: 'Tarjouksen tallennus epäonnistui', details: err.message });
  }
});

// GET /api/tarjoukset  (YLLAPITO)  — listaa tarjoukset, oletuksena odottavat
router.get('/tarjoukset', requireAdmin, async (req, res) => {
  try {
    const { tila = 'odottaa' } = req.query;
    const filter = tila === 'kaikki' ? {} : { tila };
    const tarjoukset = await Tarjous.find(filter)
      .populate('kortti_id', 'nimi numero kategoria arvo')
      .sort({ lisatty: -1 });
    res.json(tarjoukset);
  } catch (err) {
    res.status(500).json({ virhe: 'Tarjousten haku epäonnistui', details: err.message });
  }
});

// PATCH /api/tarjoukset/:id  (YLLAPITO)  — hyvaksy tai hylkaa
// body: { paatos: 'hyvaksy' | 'hylkaa' }
router.patch('/tarjoukset/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ virhe: 'Virheellinen tarjouksen id' });

  try {
    const tarjous = await Tarjous.findById(id);
    if (!tarjous) return res.status(404).json({ virhe: 'Tarjousta ei löytynyt' });
    if (tarjous.tila !== 'odottaa') {
      return res.status(409).json({ virhe: 'Tarjous on jo käsitelty' });
    }

    const kortti = await Card.findById(tarjous.kortti_id);
    const { paatos } = req.body;

    if (paatos === 'hyvaksy') {
      tarjous.tila = 'hyvaksytty';
      await tarjous.save();

      if (kortti) {
        kortti.tarjottu = false;
        kortti.myyty = {
          tila: true,
          pvm: new Date(),
          hinta: tarjous.tarjottu_hinta,
          ostaja: `${tarjous.ostajan_nimi} <${tarjous.ostajan_sahkoposti}>`,
        };
        await kortti.save();
      }

      const emailTulos = await lahetaHyvaksyntaIlmoitus({ kortti, tarjous });
      return res.json({ ok: true, tila: 'hyvaksytty', ostajalle_lahetetty: emailTulos.lahetetty });
    }

    if (paatos === 'hylkaa') {
      tarjous.tila = 'hylatty';
      await tarjous.save();
      if (kortti) {
        kortti.tarjottu = false;
        await kortti.save();
      }
      return res.json({ ok: true, tila: 'hylatty' });
    }

    return res.status(400).json({ virhe: 'paatos-kentan tulee olla "hyvaksy" tai "hylkaa"' });
  } catch (err) {
    res.status(500).json({ virhe: 'Tarjouksen käsittely epäonnistui', details: err.message });
  }
});

module.exports = router;
