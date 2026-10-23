const mongoose = require('mongoose');

const KATEGORIAT = ['Kiilto', 'Tähti', 'Trainer', 'Erikois', 'Vanhat', 'Pienet sarjat', 'Bulk'];

const cardSchema = new mongoose.Schema({
  nimi: {
    type: String,
    required: [true, 'Kortin nimi on pakollinen'],
    trim: true,
  },
  numero: {
    type: String,
    trim: true,
    default: '',
  },
  kategoria: {
    type: String,
    required: [true, 'Kategoria on pakollinen'],
    enum: {
      values: KATEGORIAT,
      message: '{VALUE} ei ole tuettu kategoria',
    },
  },
  kunto: {
    type: String,
    trim: true,
    default: 'NM/M',
  },
  arvo: {
    type: Number,
    required: [true, 'Arvo on pakollinen'],
    min: [0, 'Arvo ei voi olla negatiivinen'],
  },
  myyty: {
    tila: { type: Boolean, default: false },
    pvm: { type: Date, default: null },
    hinta: { type: Number, default: null },
    ostaja: { type: String, default: '' },
  },
  tarjottu: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: { createdAt: 'lisatty', updatedAt: 'paivitetty' },
});

cardSchema.index({ kategoria: 1 });
cardSchema.index({ arvo: -1 });
cardSchema.index({ nimi: 'text', numero: 'text' });

module.exports = mongoose.model('Card', cardSchema);
module.exports.KATEGORIAT = KATEGORIAT;
