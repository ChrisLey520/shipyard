import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

/**
 * - 使用 Vue 插件以支持 .vue 单测；不加载 UnoCSS（避免 Vitest CJS 解析 ESM 失败）。
 * - happy-dom：组件 DOM 冒烟；纯 Node 用例（如 shared 别名）同样可运行。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shipyard/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'happy-dom',
  },
});
