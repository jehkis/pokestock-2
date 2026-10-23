const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const { haeHinta } = require('../services/tcgdex');

const router = express.Router();

// GET /api/hinta-haku?nimi=Charizard&numero=12/108&holo=true   (YLLAPITO)
// Hakee Cardmarketin hinta-arvion (EUR) TCGdex-rajapinnasta.
router.get('/', requireAdmin, async (req, res) => {
  const { nimi, numero, holo } = req.query;
  if (!nimi || !String(nimi).trim()) {
    return res.status(400).json({ virhe: 'Parametri "nimi" on pakollinen' });
  }
  try {
    const tulos = await haeHinta({ nimi, numero, holo: holo === 'true' });
    res.json(tulos);
  } catch (err) {
    res.status(502).json({ virhe: 'Hintapalvelu (TCGdex) ei vastannut', details: err.message });
  }
});

module.exports = router;
