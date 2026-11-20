import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  build: { chunkSizeWarningLimit: 1500, target: 'es2022' },
});
