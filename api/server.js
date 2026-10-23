require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { connectDB } = require('./src/db');
const cardsRouter = require('./src/routes/cards');
const hintahakuRouter = require('./src/routes/hintahaku');
const tarjouksetRouter = require('./src/routes/tarjoukset');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Astro-frontendin build (web/dist). Dockerissa se kopioidaan kansioon /app/public.
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(STATIC_DIR));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'pokestock-api' }));
app.use('/api/cards', cardsRouter);
app.use('/api/hinta-haku', hintahakuRouter);
app.use('/api', tarjouksetRouter);

app.use('/api', (req, res) => res.status(404).json({ virhe: 'Reittiä ei löytynyt' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ virhe: 'Palvelinvirhe', details: err.message });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[api] PokeStock API kuuntelee portissa ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[api] Käynnistys epäonnistui:', err);
  process.exit(1);
});
