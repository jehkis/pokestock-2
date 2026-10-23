const nodemailer = require('nodemailer');

let transporter = null;
let warned = false;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    if (!warned) {
      console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD puuttuu .env:sta — sähköposti-ilmoitukset eivät lähdy, mutta sovellus toimii muuten normaalisti.');
      warned = true;
    }
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

async function lahetaTarjousIlmoitus({ kortti, tarjous }) {
  const t = getTransporter();
  const vastaanottaja = process.env.ADMIN_NOTIFY_EMAIL || process.env.GMAIL_USER;
  if (!t || !vastaanottaja) return { lahetetty: false, syy: 'sahkoposti ei konfiguroitu' };

  const otsikko = `Uusi tarjous: ${kortti.nimi} — ${tarjous.tarjottu_hinta} €`;
  const teksti = [
    `Kortti: ${kortti.nimi} ${kortti.numero || ''}`,
    `Kategoria: ${kortti.kategoria}`,
    `Oma hinta-arvio: ${kortti.arvo} €`,
    '',
    `Tarjottu hinta: ${tarjous.tarjottu_hinta} €`,
    `Tarjoaja: ${tarjous.ostajan_nimi}`,
    `Sähköposti: ${tarjous.ostajan_sahkoposti}`,
    tarjous.ostajan_viesti ? `Viesti: ${tarjous.ostajan_viesti}` : null,
    '',
    `Hyväksy tai hylkää tarjous PokeStockin ylläpitonäkymässä.`,
  ].filter(Boolean).join('\n');

  try {
    await t.sendMail({
      from: process.env.GMAIL_USER,
      to: vastaanottaja,
      replyTo: tarjous.ostajan_sahkoposti,
      subject: otsikko,
      text: teksti,
    });
    return { lahetetty: true };
  } catch (err) {
    console.error('[email] Lähetys epäonnistui:', err.message);
    return { lahetetty: false, syy: err.message };
  }
}

async function lahetaHyvaksyntaIlmoitus({ kortti, tarjous }) {
  const t = getTransporter();
  if (!t) return { lahetetty: false, syy: 'sahkoposti ei konfiguroitu' };

  const otsikko = `Tarjouksesi hyväksyttiin: ${kortti.nimi}`;
  const teksti = [
    `Hei ${tarjous.ostajan_nimi},`,
    '',
    `Tarjouksesi kortista "${kortti.nimi} ${kortti.numero || ''}" hyväksyttiin hintaan ${tarjous.tarjottu_hinta} €.`,
    '',
    'Myyjä ottaa sinuun pian yhteyttä tämän sähköpostin kautta sopiakseen toimituksesta/noudosta ja maksusta.',
    '',
    'Terveisin,',
    'PokeStock',
  ].join('\n');

  try {
    await t.sendMail({
      from: process.env.GMAIL_USER,
      to: tarjous.ostajan_sahkoposti,
      subject: otsikko,
      text: teksti,
    });
    return { lahetetty: true };
  } catch (err) {
    console.error('[email] Lähetys epäonnistui:', err.message);
    return { lahetetty: false, syy: err.message };
  }
}

module.exports = { lahetaTarjousIlmoitus, lahetaHyvaksyntaIlmoitus };
