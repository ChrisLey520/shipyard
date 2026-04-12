import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

/**
 * 小程序端只保证加载与页面同名的 .wxss；在 unocss≥66 + @dcloudio/vite-plugin-uni 下构建仍常产出 .css（issue 仍在演进）。
 * 在产物目录为每个 .css 同步一份同名 .wxss，与微信运行时约定一致；内容相同，无额外语义成本。
 * @see https://github.com/dcloudio/uni-app/issues/4061（插件顺序）及讨论中 unocss 66+ 回归说明
 */
function mirrorCssToWxssUnderDir(mpRoot: string): void {
  if (!existsSync(mpRoot)) return;

  const cssPaths: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith('.css')) cssPaths.push(full);
    }
  };
  walk(mpRoot);

  for (const cssPath of cssPaths) {
    const wxssPath = cssPath.replace(/\.css$/i, '.wxss');
    writeFileSync(wxssPath, readFileSync(cssPath, 'utf8'));
  }
}

/**
 * dev 模式偶发在 common/vendor.js 中残留独立语句 `seTranslate;`（与 wot-design-uni 的 useTranslate 及 vendor 拼接有关），
 * 运行时报 ReferenceError 并导致首页未注册。生产构建常因压缩去掉该死代码，故多见于微信开发者工具 + pnpm dev:mp-weixin。
 */
function sanitizeMpWeixinVendorJs(mpRoot: string): void {
  const vendorPath = join(mpRoot, 'common', 'vendor.js');
  if (!existsSync(vendorPath)) return;
  let code = readFileSync(vendorPath, 'utf8');
  const before = code;
  code = code.replace(/\r?\nseTranslate;\r?\n/g, '\n');
  code = code.replace(/;seTranslate;/g, ';');
  // 构建产物中 esbuild 会保留部分库的 /** */ 版权注释，微信「代码质量」可能判为脚本未压缩
  code = code.replace(/\/\*\*[\s\S]*?\*\//g, '');
  if (code !== before) {
    writeFileSync(vendorPath, code);
  }
}

/** 微信文档：minified / minifyWXSS / minifyWXML 控制上传时是否压缩；默认 false 易触发「JS 文件压缩未通过」 */
function patchMpWeixinProjectConfigForUploadMinify(mpRoot: string): void {
  const cfgPath = join(mpRoot, 'project.config.json');
  if (!existsSync(cfgPath)) return;
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
    const prev = cfg.setting;
    const setting =
      prev && typeof prev === 'object' && !Array.isArray(prev)
        ? { ...(prev as Record<string, unknown>) }
        : {};
    setting.minified = true;
    setting.minifyWXSS = true;
    setting.minifyWXML = true;
    cfg.setting = setting;
    writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  } catch {
    /* ignore */
  }
}

/**
 * 写入 project.private.config.json（仅影响本机微信开发者工具模拟器，不随上传包走）。
 * 用于规避基础库 3.15.x + 部分工具版本下 WAServiceMainContext「Error: timeout」类误报。
 */
function shipyardMpWeixinPrivateProjectConfig(): Plugin {
  const body = {
    description:
      'Shipyard：锁定较低模拟器基础库并关闭易触发异常的调试项；可在工具「详情」中改回或删除本文件',
    libVersion: '3.4.10',
    setting: {
      skylineRenderEnable: false,
      /** 官方文档：关闭可能有助于规避调试中的未知报错 */
      useIsolateContext: false,
    },
  };
  const text = `${JSON.stringify(body, null, 2)}\n`;

  return {
    name: 'shipyard-mp-weixin-private-config',
    enforce: 'post',
    closeBundle() {
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return;
      const root = process.cwd();
      for (const rel of ['dist/build/mp-weixin', 'dist/dev/mp-weixin'] as const) {
        const dir = join(root, rel);
        const appPath = join(dir, 'app.json');
        if (!existsSync(appPath)) continue;

        writeFileSync(join(dir, 'project.private.config.json'), text);

        try {
          const app = JSON.parse(readFileSync(appPath, 'utf8')) as Record<string, unknown>;
          app.lazyCodeLoading = 'requiredComponents';
          writeFileSync(appPath, `${JSON.stringify(app, null, 2)}\n`);
        } catch {
          /* ignore */
        }

        mirrorCssToWxssUnderDir(dir);
        sanitizeMpWeixinVendorJs(dir);
        patchMpWeixinProjectConfigForUploadMinify(dir);
      }
    },
  };
}

/** 动态加载 UnoCSS，避免 uni 以 CJS 方式预打包 vite 配置时 ESM-only 包报错 */
export default defineConfig(async () => {
  const UnoCSS = (await import('unocss/vite')).default;
  return {
    /**
     * UnoCSS 须在 uni() 之前（官方推荐，减轻 .css/.wxss 问题）；当前 unocss-applet 依赖 unocss≥66，
     * 单独调顺序在本仓库下仍会得到 .css，故配合 closeBundle 中的 mirrorCssToWxssUnderDir。
     */
    plugins: [UnoCSS(), uni(), shipyardMpWeixinPrivateProjectConfig()],
  };
});
