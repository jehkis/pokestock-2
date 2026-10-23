// Tayttaa MongoDB:n Joonan oikealla korttikokoelmalla (265 korttia).
// Aja: npm run seed  (tai: node seed/seed.js)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB } = require('../src/db');
const Card = require('../src/models/Card');
const mongoose = require('mongoose');

async function seed() {
  await connectDB();

  const existing = await Card.countDocuments();
  if (existing > 0) {
    console.log(`[seed] Kannassa on jo ${existing} korttia. Ei tehda mitaan.`);
    console.log('[seed] Tyhjenna kokoelma ensin jos haluat siemenata uudelleen: db.cards.deleteMany({})');
    await mongoose.disconnect();
    return;
  }

  const raw = fs.readFileSync(path.join(__dirname, 'kortit.json'), 'utf-8');
  const cards = JSON.parse(raw);

  const docs = cards.map((c) => ({
    nimi: c.nimi,
    numero: c.numero || '',
    kategoria: c.kategoria,
    kunto: c.kunto || 'NM/M',
    arvo: c.arvo,
  }));

  await Card.insertMany(docs);
  console.log(`[seed] Lisatty ${docs.length} korttia MongoDB:hen.`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] Epaonnistui:', err);
  process.exit(1);
});
