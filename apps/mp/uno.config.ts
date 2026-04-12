import { defineConfig, presetUno } from 'unocss';
import { presetApplet, presetRemRpx } from 'unocss-applet';

const isMp = process.env.UNI_PLATFORM?.startsWith('mp') ?? false;

export default defineConfig({
  presets: [isMp ? presetApplet() : presetUno(), presetRemRpx()],
});
