import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // バンドルの大半は教本本文と問題データ（意図した内容）なので、警告のしきい値を上げておく
    chunkSizeWarningLimit: 1400,
  },
  server: {
    host: true,
    port: 5173,
  },
});
