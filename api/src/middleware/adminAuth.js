// Kevyt yhden-ylläpitäjän suojaus: vaatii oikean avaimen x-admin-key -headerissa.
// Ei täysi käyttäjähallinta — riittävä yhden henkilön PokeStockille, mutta
// jos sovellukseen tulee useampi ylläpitäjä joskus, tähän kannattaa vaihtaa
// oikea kirjautuminen (esim. sessiot tai JWT).
function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return res.status(500).json({ virhe: 'ADMIN_KEY ei ole asetettu palvelimen .env-tiedostossa' });
  }
  const annettu = req.get('x-admin-key');
  if (annettu !== adminKey) {
    return res.status(401).json({ virhe: 'Väärä tai puuttuva ylläpitäjän avain' });
  }
  next();
}

module.exports = { requireAdmin };
