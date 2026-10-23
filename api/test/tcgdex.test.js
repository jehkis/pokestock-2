const test = require('node:test');
const assert = require('node:assert/strict');
const { haeHinta, parseNumero, valitseHinta, nimiVaihtoehdot, clearCache } = require('../src/services/tcgdex');

// Vale-fetch: routes = { '/cards?name=Charizard': [...], '/cards/base1-4': {...} }
function makeFetch(routes, calls = []) {
  return async (url) => {
    const path = url.replace('https://api.tcgdex.net/v2/en', '');
    calls.push(path);
    if (routes[path] instanceof Error) throw routes[path];
    if (typeof routes[path] === 'number') return { status: routes[path], ok: false, json: async () => ({}) };
    if (!(path in routes)) return { status: 404, ok: false, json: async () => ({}) };
    return { status: 200, ok: true, json: async () => routes[path] };
  };
}

const cm = { updated: '2025-08-05T00:42:15.000Z', unit: 'EUR', avg: 10, low: 8, trend: 12.345, avg7: 11, avg30: 9,
  'avg-holo': 30, 'low-holo': 25, 'trend-holo': 31.5, 'avg7-holo': 29, 'avg30-holo': 28 };

const base1_4 = { id: 'base1-4', localId: '4', name: 'Charizard', rarity: 'Rare', image: 'https://assets.tcgdex.net/en/base/base1/4',
  set: { name: 'Base Set', cardCount: { official: 102, total: 102 } }, pricing: { cardmarket: cm } };
const other_4 = { id: 'xyz-4', localId: '4', name: 'Charizard', set: { name: 'Other Set', cardCount: { official: 130, total: 140 } },
  pricing: { cardmarket: { unit: 'EUR', trend: 1 } } };

test.beforeEach(() => clearCache());

test('parseNumero: nollat, kauttaviiva ja promo-tunnukset', () => {
  assert.deepEqual(parseNumero('091/086'), { local: '91', total: 86 });
  assert.deepEqual(parseNumero('12/108'), { local: '12', total: 108 });
  assert.deepEqual(parseNumero('SM113'), { local: 'SM113', total: null });
  assert.deepEqual(parseNumero(''), { local: null, total: null });
  assert.deepEqual(parseNumero(undefined), { local: null, total: null });
});

test('nimiVaihtoehdot: poistaa paatteen ja kokeilee ensimmaista sanaa', () => {
  assert.deepEqual(nimiVaihtoehdot('Charizard EX'), ['Charizard EX', 'Charizard']);
  assert.deepEqual(nimiVaihtoehdot('Pikachu'), ['Pikachu']);
  assert.ok(nimiVaihtoehdot('Alolan Muk').includes('Alolan'));
});

test('loytaa kortin numerolla vaikka etunollat eroavat', async () => {
  const f = makeFetch({
    '/cards?name=Xerneas': [{ id: 'me-91', localId: '091', name: 'Xerneas' }, { id: 'me-1', localId: '001', name: 'Xerneas' }],
    '/cards/me-91': { id: 'me-91', localId: '091', name: 'Xerneas', set: { name: 'Chaos Rising', cardCount: { official: 86, total: 100 } }, pricing: { cardmarket: { unit: 'EUR', trend: 15.5 } } },
  });
  const r = await haeHinta({ nimi: 'Xerneas', numero: '91/086' }, f);
  assert.equal(r.loytyi, true);
  assert.equal(r.paras.setti, 'Chaos Rising');
  assert.equal(r.paras.hinta.arvo, 15.5);
});

test('samalla numerolla useita settejä: nimittäjä ratkaisee', async () => {
  const f = makeFetch({
    '/cards?name=Charizard': [{ id: 'xyz-4', localId: '4', name: 'Charizard' }, { id: 'base1-4', localId: '4', name: 'Charizard' }],
    '/cards/xyz-4': other_4, '/cards/base1-4': base1_4,
  });
  const r = await haeHinta({ nimi: 'Charizard', numero: '4/102' }, f);
  assert.equal(r.paras.id, 'base1-4');
  assert.equal(r.ehdotukset[0].id, 'xyz-4');
});

test('holo=false valitsee trendin, holo=true holo-trendin, pyoristys 2 desimaaliin', async () => {
  const routes = { '/cards?name=Charizard': [{ id: 'base1-4', localId: '4', name: 'Charizard' }], '/cards/base1-4': base1_4 };
  const normaali = await haeHinta({ nimi: 'Charizard', numero: '4/102', holo: false }, makeFetch(routes));
  assert.equal(normaali.paras.hinta.arvo, 12.35);
  assert.equal(normaali.paras.hinta.variantti, 'normaali');
  clearCache();
  const holo = await haeHinta({ nimi: 'Charizard', numero: '4/102', holo: true }, makeFetch(routes));
  assert.equal(holo.paras.hinta.arvo, 31.5);
  assert.equal(holo.paras.hinta.variantti, 'holo');
  assert.equal(holo.paras.hinta.yksikko, 'EUR');
});

test('holo pyydetty mutta holo-hintaa ei ole: putoaa normaaliin hintaan', () => {
  const h = valitseHinta({ cardmarket: { unit: 'EUR', trend: 0.5 } }, true);
  assert.equal(h.arvo, 0.5);
  assert.equal(h.variantti, 'normaali');
  assert.equal(h.holo, null);
});

test('kortti ilman Cardmarket-hintaa: loytyy mutta hinta on null', async () => {
  const f = makeFetch({
    '/cards?name=Promo': [{ id: 'p-1', localId: '1', name: 'Promo' }],
    '/cards/p-1': { id: 'p-1', localId: '1', name: 'Promo', set: { name: 'Promos' }, pricing: { tcgplayer: {} } },
  });
  const r = await haeHinta({ nimi: 'Promo', numero: '1' }, f);
  assert.equal(r.loytyi, true);
  assert.equal(r.paras.hinta, null);
});

test('numero ei tasmaa: loytyi=false ja ehdotukset nimen perusteella', async () => {
  const f = makeFetch({ '/cards?name=Charizard': [{ id: 'base1-4', localId: '4', name: 'Charizard' }] });
  const r = await haeHinta({ nimi: 'Charizard', numero: '999/999' }, f);
  assert.equal(r.loytyi, false);
  assert.equal(r.ehdotukset[0].id, 'base1-4');
});

test('nimivaihtoehto: "Charizard EX" ei tuota tulosta, "Charizard" tuottaa', async () => {
  const calls = [];
  const f = makeFetch({
    '/cards?name=Charizard%20EX': [],
    '/cards?name=Charizard': [{ id: 'base1-4', localId: '4', name: 'Charizard' }],
    '/cards/base1-4': base1_4,
  }, calls);
  const r = await haeHinta({ nimi: 'Charizard EX', numero: '4/102' }, f);
  assert.equal(r.loytyi, true);
  assert.equal(calls[0], '/cards?name=Charizard%20EX');
});

test('404 hakuun kasitellaan tyhjana tuloksena', async () => {
  const r = await haeHinta({ nimi: 'Olematon', numero: '1' }, makeFetch({}));
  assert.equal(r.loytyi, false);
});

test('palvelinvirhe (500) nostaa virheen', async () => {
  await assert.rejects(haeHinta({ nimi: 'Charizard' }, makeFetch({ '/cards?name=Charizard': 500 })), /500/);
});

test('verkkovirhe nostaa virheen', async () => {
  await assert.rejects(haeHinta({ nimi: 'Charizard' }, makeFetch({ '/cards?name=Charizard': new Error('ECONNREFUSED') })), /ECONNREFUSED/);
});

test('tyhja nimi hylataan', async () => {
  await assert.rejects(haeHinta({ nimi: '  ' }, makeFetch({})), /nimi puuttuu/);
});

test('valimuisti: sama haku ei mene rajapintaan kahdesti', async () => {
  const calls = [];
  const f = makeFetch({ '/cards?name=Charizard': [{ id: 'base1-4', localId: '4', name: 'Charizard' }], '/cards/base1-4': base1_4 }, calls);
  await haeHinta({ nimi: 'Charizard', numero: '4/102' }, f);
  const ensimmainen = calls.length;
  await haeHinta({ nimi: 'Charizard', numero: '4/102' }, f);
  assert.equal(calls.length, ensimmainen);
});
