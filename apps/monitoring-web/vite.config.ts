import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5174,
    proxy: {
      '/monitoring-api': {
        target: process.env.VITE_MONITORING_API_PROXY ?? 'http://127.0.0.1:3030',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/monitoring-api/, ''),
      },
    },
  },
});
