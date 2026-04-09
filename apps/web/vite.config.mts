import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Unocss from 'unocss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const monorepoRoot = resolve(__dirname, '../..');
  const env = loadEnv(mode, monorepoRoot, '');
  const proxyTarget = env['VITE_DEV_PROXY_TARGET'] || 'http://localhost:3000';

  return {
    envDir: monorepoRoot,
    plugins: [
      vue(),
      Unocss(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shipyard/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: proxyTarget,
          ws: true,
        },
      },
    },
  };
});

