import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/ws': {
        target: process.env.WS_TARGET ?? 'ws://localhost:8080',
        ws: true,
      },
    },
  },
});
