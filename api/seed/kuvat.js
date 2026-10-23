// Hakee TCGdexista kuvan jokaiselle kortille, jolta se puuttuu.
// Aja: npm run kuvat   (kaikki uudelleen: npm run kuvat -- --kaikki)
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/db');
const Card = require('../src/models/Card');
const { haeHinta } = require('../src/services/tcgdex');

const RINNAKKAIN = 4;

async function main() {
  await connectDB();
  const kaikki = process.argv.includes('--kaikki');
  const cards = await Card.find(kaikki ? {} : { $or: [{ kuva: '' }, { kuva: { $exists: false } }] });
  console.log(`[kuvat] Haetaan kuva ${cards.length} kortille...`);

  const puuttuu = [];
  let loytyi = 0;
  let i = 0;
  async function tyontekija() {
    while (i < cards.length) {
      const card = cards[i++];
      try {
        const haku = await haeHinta({ nimi: card.nimi, numero: card.numero, holo: card.kategoria === 'Kiilto' });
        if (haku.loytyi && haku.paras.kuva) {
          card.kuva = haku.paras.kuva;
          await card.save();
          loytyi += 1;
        } else {
          puuttuu.push(`${card.nimi} ${card.numero}`);
        }
      } catch (err) {
        puuttuu.push(`${card.nimi} ${card.numero} (${err.message})`);
      }
    }
  }
  await Promise.all(Array.from({ length: RINNAKKAIN }, tyontekija));

  console.log(`[kuvat] Kuva löytyi ${loytyi}/${cards.length} kortille.`);
  if (puuttuu.length) console.log(`[kuvat] Ei kuvaa (${puuttuu.length}):\n  ` + puuttuu.join('\n  '));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[kuvat] Epäonnistui:', err);
  process.exit(1);
});
