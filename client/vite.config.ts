import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // у розробці — локальний сервер Хелпера (AUTO_WORD_GENERATOR) на :8080
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: { outDir: 'dist', sourcemap: false },
});
