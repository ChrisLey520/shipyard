import { defineConfig, presetUno } from 'unocss';
import { presetApplet, presetRemRpx } from 'unocss-applet';

/** 小程序端用 applet 预设；H5（如 pnpm dev:h5）用 presetUno。.css→.wxss 由 vite closeBundle 镜像处理，与此处无关。 */
const isMp = process.env.UNI_PLATFORM?.startsWith('mp') ?? false;

export default defineConfig({
  presets: [isMp ? presetApplet() : presetUno(), presetRemRpx()],
});
