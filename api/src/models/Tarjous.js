const mongoose = require('mongoose');

const tarjousSchema = new mongoose.Schema({
  kortti_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true,
  },
  ostajan_nimi: {
    type: String,
    required: [true, 'Nimi on pakollinen'],
    trim: true,
  },
  ostajan_sahkoposti: {
    type: String,
    required: [true, 'Sähköposti on pakollinen'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Sähköpostiosoite ei kelpaa'],
  },
  ostajan_viesti: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },
  tarjottu_hinta: {
    type: Number,
    required: [true, 'Tarjottu hinta on pakollinen'],
    min: [0, 'Hinta ei voi olla negatiivinen'],
  },
  tila: {
    type: String,
    enum: ['odottaa', 'hyvaksytty', 'hylatty'],
    default: 'odottaa',
  },
}, {
  timestamps: { createdAt: 'lisatty', updatedAt: 'paivitetty' },
});

tarjousSchema.index({ kortti_id: 1, tila: 1 });

module.exports = mongoose.model('Tarjous', tarjousSchema);
