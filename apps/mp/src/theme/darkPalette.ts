import type { ThemeId } from './types';

/**
 * 与 Web `apps/web/src/theme/themes.ts` 深色 palette 对齐（body / header / tab 区略作色相区分）
 */
export const darkBodyBackground: Record<ThemeId, string> = {
  fresh: '#0c1411',
  ocean: '#0a1420',
  violet: '#100f1a',
};

export const darkHeaderBackground: Record<ThemeId, string> = {
  fresh: '#0a1210',
  ocean: '#08121e',
  violet: '#0d0c16',
};

/** 底部 Tab 栏深色底，与侧栏/顶栏同系 */
export const darkTabBarBackground: Record<ThemeId, string> = {
  fresh: '#0a1210',
  ocean: '#08121e',
  violet: '#0d0c16',
};

/** 卡片/区块深色底（与 Web cardColor 对齐） */
export const darkCardBackground: Record<ThemeId, string> = {
  fresh: '#111f1b',
  ocean: '#0f1c2f',
  violet: '#161528',
};

/** 登录/注册页深色全屏渐变（色相与对应主题一致） */
export const authPageDarkBackground: Record<ThemeId, string> = {
  fresh: 'linear-gradient(165deg, #0a1512 0%, #0c1815 38%, #111f1b 100%)',
  ocean: 'linear-gradient(165deg, #061018 0%, #0a1420 38%, #0f1c2f 100%)',
  violet: 'linear-gradient(165deg, #0c0a14 0%, #100f1a 38%, #161528 100%)',
};

/** 注册页沿用原 180° 渐变方向 */
export const authRegisterPageDarkBackground: Record<ThemeId, string> = {
  fresh: 'linear-gradient(180deg, #0a1512 0%, #0c1815 45%, #111f1b 100%)',
  ocean: 'linear-gradient(180deg, #061018 0%, #0a1420 45%, #0f1c2f 100%)',
  violet: 'linear-gradient(180deg, #0c0a14 0%, #100f1a 45%, #161528 100%)',
};
