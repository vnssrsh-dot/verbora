import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import contentIndex, { cyIcons } from './content-index.js';

// SINGLE_FILE=1 bundles every unit into one script (for embedding a demo in a single page).
const single = Boolean(process.env.SINGLE_FILE);

export default defineConfig({
  base: './',
  plugins: [react(), contentIndex(), cyIcons()],
  build: single ? { outDir: 'dist-single', rollupOptions: { output: { inlineDynamicImports: true } } } : {},
});
