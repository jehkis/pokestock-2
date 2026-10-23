const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pokestock';
  mongoose.set('strictQuery', true);

  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log(`[db] Yhdistetty MongoDB:hen (${uri})`);
      return;
    } catch (err) {
      console.error(`[db] Yhteysyritys ${attempt}/${maxRetries} epäonnistui: ${err.message}`);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

module.exports = { connectDB };
