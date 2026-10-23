// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      // Kehityksessa (npm run dev) /api-kutsut valitetaan Express-rajapinnalle.
      proxy: { '/api': 'http://localhost:3000' },
    },
  },

  adapter: node({
    mode: 'middleware',
  }),
});