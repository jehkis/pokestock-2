// Kytkee myyjän omat valokuvat (web/public/kortit) kortteihin listan seed/omat-kuvat.json mukaan.
// Lista on tehty käymällä kuvat läpi silmämääräisesti: alkuperäisten kuvatiedostojen nimet
// eivät aina vastanneet kuvassa olevaa korttia.
// Aja: npm run omat-kuvat   (kaikki uudelleen: npm run omat-kuvat -- --kaikki)
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/db');
const Card = require('../src/models/Card');
const kuvat = require('./omat-kuvat.json');

async function main() {
  await connectDB();
  if (process.argv.includes('--kaikki')) await Card.updateMany({}, { omaKuva: '' });

  // Samannimisiä kortteja voi olla useita (esim. 3 × Sobble 24/25): jokainen kuva annetaan
  // seuraavalle kortille, jolla omaa kuvaa ei vielä ole
  let kytketty = 0;
  const puuttuu = [];
  for (const k of kuvat) {
    const polku = `/kortit/${k.tiedosto}.webp`;
    if (await Card.exists({ omaKuva: polku })) continue;
    const card = await Card.findOne({ nimi: k.nimi, numero: k.numero, kategoria: k.kategoria, omaKuva: { $in: ['', null] } });
    if (!card) { puuttuu.push(`${k.nimi} ${k.numero} (${k.kategoria})`); continue; }
    card.omaKuva = polku;
    await card.save();
    kytketty += 1;
  }

  console.log(`[omat-kuvat] Kytketty ${kytketty} kuvaa, ${await Card.countDocuments({ omaKuva: { $nin: ['', null] } })} kortilla on oma kuva.`);
  if (puuttuu.length) console.log(`[omat-kuvat] Korttia ei löytynyt (${puuttuu.length}):\n  ` + puuttuu.join('\n  '));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[omat-kuvat] Epäonnistui:', err);
  process.exit(1);
});
