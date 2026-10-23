const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.ADMIN_KEY = 'testiavain';
const hintahaku = require('../src/routes/hintahaku');
const { clearCache } = require('../src/services/tcgdex');

const oikeaFetch = global.fetch;
let tcgdexTila = 'ok';

// Vale vain TCGdex-osoitteille, muut (localhost) menevat oikeaan fetchiin
global.fetch = async (url, opts) => {
  if (!String(url).startsWith('https://api.tcgdex.net')) return oikeaFetch(url, opts);
  if (tcgdexTila === 'alas') throw new Error('ECONNREFUSED');
  const path = String(url).replace('https://api.tcgdex.net/v2/en', '');
  const data = {
    '/cards?name=Xerneas': [{ id: 'me-91', localId: '091', name: 'Xerneas' }],
    '/cards/me-91': { id: 'me-91', localId: '091', name: 'Xerneas', set: { name: 'Chaos Rising', cardCount: { official: 86, total: 100 } },
      pricing: { cardmarket: { unit: 'EUR', updated: '2026-09-27T00:00:00.000Z', trend: 15.5, 'trend-holo': 19.2 } } },
  }[path];
  if (!data) return { status: 404, ok: false, json: async () => ({}) };
  return { status: 200, ok: true, json: async () => data };
};

let server, base;
test.before(async () => {
  const app = express();
  app.use('/api/hinta-haku', hintahaku);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api/hinta-haku`;
});
test.after(() => server.close());
test.beforeEach(() => { clearCache(); tcgdexTila = 'ok'; });

test('ilman avainta: 401', async () => {
  const r = await fetch(`${base}?nimi=Xerneas`);
  assert.equal(r.status, 401);
});

test('vaara avain: 401', async () => {
  const r = await fetch(`${base}?nimi=Xerneas`, { headers: { 'x-admin-key': 'vaara' } });
  assert.equal(r.status, 401);
});

test('oikea avain mutta ei nimea: 400', async () => {
  const r = await fetch(base, { headers: { 'x-admin-key': 'testiavain' } });
  assert.equal(r.status, 400);
});

test('onnistunut haku palauttaa hinnan ja setin', async () => {
  const r = await fetch(`${base}?nimi=Xerneas&numero=091/086`, { headers: { 'x-admin-key': 'testiavain' } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.loytyi, true);
  assert.equal(j.paras.setti, 'Chaos Rising');
  assert.equal(j.paras.hinta.arvo, 15.5);
});

test('holo=true palauttaa holo-hinnan', async () => {
  const r = await fetch(`${base}?nimi=Xerneas&numero=091/086&holo=true`, { headers: { 'x-admin-key': 'testiavain' } });
  const j = await r.json();
  assert.equal(j.paras.hinta.arvo, 19.2);
  assert.equal(j.paras.hinta.variantti, 'holo');
});

test('tuntematon kortti: 200 ja loytyi=false', async () => {
  const r = await fetch(`${base}?nimi=Olematon&numero=1`, { headers: { 'x-admin-key': 'testiavain' } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).loytyi, false);
});

test('TCGdex alhaalla: 502 ja selkea virheilmoitus', async () => {
  tcgdexTila = 'alas';
  const r = await fetch(`${base}?nimi=Xerneas&numero=091/086`, { headers: { 'x-admin-key': 'testiavain' } });
  assert.equal(r.status, 502);
  assert.match((await r.json()).virhe, /TCGdex/);
});
