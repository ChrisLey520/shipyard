import type { ThemeId } from './types';

/**
 * 主色与 Web palette 一致，供 Wot Design 的 themeVars（colorTheme、Tab 高亮等）
 */
const ACCENT: Record<ThemeId, { light: string; dark: string }> = {
  fresh: { light: '#16a34a', dark: '#22c55e' },
  ocean: { light: '#0284c7', dark: '#38bdf8' },
  violet: { light: '#7c3aed', dark: '#a78bfa' },
};

export function buildWotThemeVars(themeId: ThemeId, isDark: boolean): Record<string, string> {
  const primary = ACCENT[themeId][isDark ? 'dark' : 'light'];
  return {
    colorTheme: primary,
    buttonPrimaryBgColor: primary,
    buttonPrimaryColor: '#ffffff',
    tabbarActiveColor: primary,
  };
}

export function tabBarSelectedHex(themeId: ThemeId, isDark: boolean): string {
  return ACCENT[themeId][isDark ? 'dark' : 'light'];
}
