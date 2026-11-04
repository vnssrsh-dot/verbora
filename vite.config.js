import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import contentIndex from './content-index.js';

export default defineConfig({
  base: './',
  plugins: [react(), contentIndex()],
});
