// Hintahaku TCGdex-rajapinnasta (https://tcgdex.dev). Avainta ei tarvita.
// Kortin vastauksessa on mukana Cardmarketin hinnat euroina (pricing.cardmarket).
//
// Haku tehdaan kahdessa vaiheessa:
//   1) GET /cards?name=...        -> lyhyet kortit (id, localId, name)
//   2) GET /cards/{id}            -> koko kortti, jossa setti ja hinnat
const BASE = process.env.TCGDEX_BASE_URL || 'https://api.tcgdex.net/v2/en';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000; // hinnat paivittyvat vain kerran paivassa
const MAX_CACHE = 500;
const MAX_CANDIDATES = 6;

const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.t > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.v;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { t: Date.now(), v: value });
}

function clearCache() {
  cache.clear();
}

async function getJson(path, fetchImpl) {
  const cached = cacheGet(path);
  if (cached !== undefined) return cached;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(BASE + path, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) {
      cacheSet(path, null);
      return null;
    }
    if (!res.ok) throw new Error(`TCGdex vastasi tilalla ${res.status}`);
    const data = await res.json();
    cacheSet(path, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// "091/086" -> { local: "91", total: 86 }, "SM113" -> { local: "SM113", total: null }
function parseNumero(numero) {
  if (!numero || !String(numero).trim()) return { local: null, total: null };
  const [a, b] = String(numero).trim().split('/');
  return { local: normLocal(a), total: b ? parseInt(b, 10) || null : null };
}

function normLocal(s) {
  const v = String(s ?? '').trim().toUpperCase();
  return /^\d+$/.test(v) ? String(parseInt(v, 10)) : v;
}

// Nimivaihtoehdot: TCGdex kirjoittaa esim. "Charizard-EX" eri tavalla kuin kortti.
function nimiVaihtoehdot(nimi) {
  const puhdas = String(nimi).trim().replace(/\s+/g, ' ');
  const ilmanPaatetta = puhdas.replace(/\s+(ex|gx|v|vmax|vstar|lv\.x|ex|prime|prism star)$/i, '');
  const ensimmainen = puhdas.split(' ')[0];
  return [...new Set([puhdas, ilmanPaatetta, ensimmainen].filter(Boolean))];
}

function pyorista(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Valitsee Cardmarket-hinnan. holo=true -> ensisijaisesti holo-hinnat.
function valitseHinta(pricing, holo) {
  const cm = pricing && pricing.cardmarket;
  if (!cm) return null;

  const normaali = { trend: pyorista(cm.trend), avg: pyorista(cm.avg), avg7: pyorista(cm.avg7), avg30: pyorista(cm.avg30), low: pyorista(cm.low) };
  const holoHinnat = {
    trend: pyorista(cm['trend-holo']), avg: pyorista(cm['avg-holo']), avg7: pyorista(cm['avg7-holo']),
    avg30: pyorista(cm['avg30-holo']), low: pyorista(cm['low-holo']),
  };
  const onHolo = Object.values(holoHinnat).some((v) => v !== null);

  const jarjestys = holo ? [holoHinnat, normaali] : [normaali];
  let arvo = null;
  let variantti = null;
  for (const setti of jarjestys) {
    const v = setti.trend ?? setti.avg ?? setti.avg30 ?? setti.low;
    if (v !== null && v !== undefined) {
      arvo = v;
      variantti = setti === holoHinnat ? 'holo' : 'normaali';
      break;
    }
  }

  return {
    arvo,
    variantti,
    yksikko: cm.unit || 'EUR',
    paivitetty: cm.updated || null,
    normaali,
    holo: onHolo ? holoHinnat : null,
  };
}

function tiivista(kortti, holo) {
  const set = kortti.set || {};
  return {
    id: kortti.id,
    nimi: kortti.name,
    numero: kortti.localId,
    setti: set.name || null,
    setin_koko: set.cardCount ? { virallinen: set.cardCount.official, yhteensa: set.cardCount.total } : null,
    harvinaisuus: kortti.rarity || null,
    kuva: kortti.image ? `${kortti.image}/low.webp` : null,
    hinta: valitseHinta(kortti.pricing, holo),
  };
}

function pisteet(t, total) {
  let p = 0;
  if (total && t.setin_koko && (t.setin_koko.virallinen === total || t.setin_koko.yhteensa === total)) p += 10;
  if (t.hinta && t.hinta.arvo !== null) p += 1;
  return p;
}

// Paapalvelu. Palauttaa { loytyi, paras, ehdotukset }.
async function haeHinta({ nimi, numero, holo = false }, fetchImpl = fetch) {
  if (!nimi || !String(nimi).trim()) throw new Error('nimi puuttuu');
  const { local, total } = parseNumero(numero);

  let osumat = [];
  let kaikkiEhdokkaat = [];
  for (const vaihtoehto of nimiVaihtoehdot(nimi)) {
    const lista = (await getJson(`/cards?name=${encodeURIComponent(vaihtoehto)}`, fetchImpl)) || [];
    if (!Array.isArray(lista) || !lista.length) continue;
    kaikkiEhdokkaat = kaikkiEhdokkaat.length ? kaikkiEhdokkaat : lista;
    osumat = local ? lista.filter((c) => normLocal(c.localId) === local) : lista;
    if (osumat.length) break;
  }

  if (!osumat.length) {
    return {
      loytyi: false,
      ehdotukset: kaikkiEhdokkaat.slice(0, 5).map((c) => ({ id: c.id, nimi: c.name, numero: c.localId })),
    };
  }

  const ehdokkaat = osumat.slice(0, MAX_CANDIDATES);
  const taydet = await Promise.all(
    ehdokkaat.map((c) => getJson(`/cards/${encodeURIComponent(c.id)}`, fetchImpl).catch(() => null))
  );
  const tiivistetyt = taydet.filter(Boolean).map((k) => tiivista(k, holo));
  if (!tiivistetyt.length) return { loytyi: false, ehdotukset: [] };

  tiivistetyt.sort((a, b) => pisteet(b, total) - pisteet(a, total));
  return {
    loytyi: true,
    paras: tiivistetyt[0],
    ehdotukset: tiivistetyt.slice(1, 5),
  };
}

module.exports = { haeHinta, parseNumero, normLocal, nimiVaihtoehdot, valitseHinta, clearCache };
