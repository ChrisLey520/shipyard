import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

/** 动态加载 UnoCSS，避免 uni 以 CJS 方式预打包 vite 配置时 ESM-only 包报错 */
export default defineConfig(async () => {
  const UnoCSS = (await import('unocss/vite')).default;
  return {
    plugins: [uni(), UnoCSS()],
  };
});
