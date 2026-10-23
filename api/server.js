require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const cors = require('cors');
const { connectDB } = require('./src/db');
const cardsRouter = require('./src/routes/cards');
const hintahakuRouter = require('./src/routes/hintahaku');
const tarjouksetRouter = require('./src/routes/tarjoukset');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Astro-frontendin build (web/dist): valmiit sivut kansiossa client/, palvelinsivut server/entry.mjs
const WEB_DIST = process.env.WEB_DIST || path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(path.join(WEB_DIST, 'client')));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'pokestock-api' }));
app.use('/api/cards', cardsRouter);
app.use('/api/hinta-haku', hintahakuRouter);
app.use('/api', tarjouksetRouter);

app.use('/api', (req, res) => res.status(404).json({ virhe: 'Reittiä ei löytynyt' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ virhe: 'Palvelinvirhe', details: err.message });
});

// Astron palvelimella renderöitävät sivut (esim. /kortti/:id). Kehityksessä buildia ei tarvita:
// silloin sivut tulevat astro dev -palvelimelta portista 4321.
async function lisaaAstroSivut() {
  const entry = path.join(WEB_DIST, 'server', 'entry.mjs');
  if (!fs.existsSync(entry)) {
    console.warn(`[api] Astro-buildia ei löytynyt (${entry}) — korttisivut eivät ole käytössä tässä palvelimessa`);
    return;
  }
  const { handler } = await import(pathToFileURL(entry).href);
  app.use(handler);
}

async function start() {
  await connectDB();
  await lisaaAstroSivut();
  app.listen(PORT, () => {
    console.log(`[api] PokeStock API kuuntelee portissa ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[api] Käynnistys epäonnistui:', err);
  process.exit(1);
});
