// Ylläpidosta ladatun korttikuvan käsittely: käännetään oikein päin, rajataan kortti
// tummalta taustalta, poistetaan EXIF (myös puhelimen GPS-sijainti) ja tehdään kaksi webp-kokoa.
const sharp = require('sharp');

const ISO = 1000; // korttisivu, korkeus px
const PIENI = 480; // kaupan ruudukko
const ANALYYSI = 300; // rajauksen tunnistus tehdään pienennetystä kuvasta

// Pisin yhtenäinen jakso, jossa vaaleiden pikselien osuus ylittää rajan
function pisinJakso(osuudet, raja) {
  let paras = null;
  let alku = -1;
  osuudet.forEach((o, i) => {
    if (o > raja && alku < 0) alku = i;
    if ((o <= raja || i === osuudet.length - 1) && alku >= 0) {
      const loppu = o > raja ? i : i - 1;
      if (!paras || loppu - alku > paras[1] - paras[0]) paras = [alku, loppu];
      alku = -1;
    }
  });
  return paras;
}

// Kortin rajat (vaalea kortti tummalla alustalla) tai null, jos korttia ei tunnistettu luotettavasti
async function tunnistaKortti(kuva) {
  const { data, info } = await sharp(kuva).rotate().resize(ANALYYSI).greyscale().blur(3)
    .raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  for (const kynnys of [0.3, 0.5]) {
    const raja = kynnys * 255;
    const sarakkeet = new Array(w).fill(0);
    const rivit = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[y * w + x] > raja) { sarakkeet[x]++; rivit[y]++; }
      }
    }
    const x = pisinJakso(sarakkeet.map((n) => n / h), 0.25);
    const y = pisinJakso(rivit.map((n) => n / w), 0.25);
    if (!x || !y) continue;

    const kw = x[1] - x[0] + 1;
    const kh = y[1] - y[0] + 1;
    const suhde = Math.min(kw, kh) / Math.max(kw, kh); // kortti 63 × 88 mm ≈ 0,72, pysty tai vaaka
    if (suhde < 0.66 || suhde > 0.78 || kw * kh > 0.8 * w * h) continue;

    const m = 0.03; // pieni marginaali, ettei kortin reuna leikkaudu
    const x0 = Math.max(0, x[0] - m * kw);
    const y0 = Math.max(0, y[0] - m * kh);
    return {
      x0: x0 / w, y0: y0 / h,
      x1: Math.min(w, x[1] + 1 + m * kw) / w,
      y1: Math.min(h, y[1] + 1 + m * kh) / h,
    };
  }
  return null;
}

async function kasitteleKorttikuva(kuva) {
  const meta = await sharp(kuva).metadata();
  if (!meta.width || !meta.height) throw new Error('Tiedosto ei ole kuva');
  const kaannetty = (meta.orientation || 1) >= 5; // EXIF-kääntö vaihtaa leveyden ja korkeuden
  const W = kaannetty ? meta.height : meta.width;
  const H = kaannetty ? meta.width : meta.height;

  const r = await tunnistaKortti(kuva);
  const pohja = () => {
    const s = sharp(kuva).rotate();
    if (!r) return s;
    return s.extract({
      left: Math.round(r.x0 * W), top: Math.round(r.y0 * H),
      width: Math.round((r.x1 - r.x0) * W), height: Math.round((r.y1 - r.y0) * H),
    });
  };
  // sharp jättää metatiedot pois oletuksena
  const [iso, pieni] = await Promise.all([
    pohja().resize({ height: ISO, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    pohja().resize({ height: PIENI, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
  ]);
  return { iso, pieni, rajattu: !!r };
}

module.exports = { kasitteleKorttikuva };
