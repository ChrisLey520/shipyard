import { darkTheme, type GlobalThemeOverrides } from 'naive-ui';

export type ThemeId = 'fresh' | 'ocean' | 'violet';
export type ColorMode = 'auto' | 'light' | 'dark';

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string }> = [
  { id: 'fresh', label: '清新绿' },
  { id: 'ocean', label: '海盐蓝' },
  { id: 'violet', label: '雾紫' },
];

type ThemePalette = {
  primary: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  baseColor: string;
  bodyColor: string;
  cardColor: string;
  text1: string;
  text2: string;
  text3: string;
  border: string;
  siderColor: string;
  headerColor: string;
  contentColor: string;
};

function palette(themeId: ThemeId, isDark: boolean): ThemePalette {
  if (!isDark) {
    switch (themeId) {
      case 'fresh':
        return {
          primary: '#16a34a',
          info: '#2563eb',
          success: '#16a34a',
          warning: '#f59e0b',
          error: '#ef4444',
          baseColor: '#ffffff',
          bodyColor: '#f6f8fa',
          cardColor: '#ffffff',
          text1: '#0f172a',
          text2: '#334155',
          text3: '#64748b',
          border: 'rgba(15,23,42,0.14)',
          siderColor: '#ffffff',
          headerColor: '#ffffff',
          contentColor: '#f6f8fa',
        };
      case 'ocean':
        return {
          primary: '#0284c7',
          info: '#2563eb',
          success: '#16a34a',
          warning: '#f59e0b',
          error: '#ef4444',
          baseColor: '#ffffff',
          bodyColor: '#f7fafc',
          cardColor: '#ffffff',
          text1: '#0f172a',
          text2: '#334155',
          text3: '#64748b',
          border: 'rgba(15,23,42,0.14)',
          siderColor: '#ffffff',
          headerColor: '#ffffff',
          contentColor: '#f7fafc',
        };
      case 'violet':
        return {
          primary: '#7c3aed',
          info: '#2563eb',
          success: '#16a34a',
          warning: '#f59e0b',
          error: '#ef4444',
          baseColor: '#ffffff',
          bodyColor: '#f7f7fb',
          cardColor: '#ffffff',
          text1: '#0f172a',
          text2: '#334155',
          text3: '#64748b',
          border: 'rgba(15,23,42,0.14)',
          siderColor: '#ffffff',
          headerColor: '#ffffff',
          contentColor: '#f7f7fb',
        };
      default: {
        const _exhaustive: never = themeId;
        return _exhaustive;
      }
    }
  }

  switch (themeId) {
    case 'fresh':
      return {
        primary: '#22c55e',
        info: '#60a5fa',
        success: '#22c55e',
        warning: '#fbbf24',
        error: '#f87171',
        baseColor: '#0b1220',
        bodyColor: '#0b1220',
        cardColor: '#0f1b2e',
        text1: '#e6edf3',
        text2: '#cbd5e1',
        text3: '#94a3b8',
        border: 'rgba(148,163,184,0.18)',
        siderColor: '#0a1426',
        headerColor: '#0a1426',
        contentColor: '#0b1220',
      };
    case 'ocean':
      return {
        primary: '#38bdf8',
        info: '#60a5fa',
        success: '#22c55e',
        warning: '#fbbf24',
        error: '#f87171',
        baseColor: '#0b1220',
        bodyColor: '#0b1220',
        cardColor: '#0f1b2e',
        text1: '#e6edf3',
        text2: '#cbd5e1',
        text3: '#94a3b8',
        border: 'rgba(148,163,184,0.18)',
        siderColor: '#0a1426',
        headerColor: '#0a1426',
        contentColor: '#0b1220',
      };
    case 'violet':
      return {
        primary: '#a78bfa',
        info: '#60a5fa',
        success: '#22c55e',
        warning: '#fbbf24',
        error: '#f87171',
        baseColor: '#0b1220',
        bodyColor: '#0b1220',
        cardColor: '#0f1b2e',
        text1: '#e6edf3',
        text2: '#cbd5e1',
        text3: '#94a3b8',
        border: 'rgba(148,163,184,0.18)',
        siderColor: '#0a1426',
        headerColor: '#0a1426',
        contentColor: '#0b1220',
      };
    default: {
      const _exhaustive: never = themeId;
      return _exhaustive;
    }
  }
}

function hoverColor(themeId: ThemeId, isDark: boolean): string {
  if (isDark) return palette(themeId, true).primary;
  switch (themeId) {
    case 'fresh':
      return '#22c55e';
    case 'ocean':
      return '#0ea5e9';
    case 'violet':
      return '#8b5cf6';
    default: {
      const _exhaustive: never = themeId;
      return _exhaustive;
    }
  }
}

function pressedColor(themeId: ThemeId, isDark: boolean): string {
  if (isDark) return palette(themeId, true).primary;
  switch (themeId) {
    case 'fresh':
      return '#15803d';
    case 'ocean':
      return '#0369a1';
    case 'violet':
      return '#6d28d9';
    default: {
      const _exhaustive: never = themeId;
      return _exhaustive;
    }
  }
}

export function getNaiveTheme(isDark: boolean) {
  return isDark ? darkTheme : null;
}

export function createNaiveOverrides(themeId: ThemeId, isDark: boolean): GlobalThemeOverrides {
  const p = palette(themeId, isDark);
  return {
    common: {
      primaryColor: p.primary,
      primaryColorHover: hoverColor(themeId, isDark),
      primaryColorPressed: pressedColor(themeId, isDark),

      successColor: p.success,
      warningColor: p.warning,
      errorColor: p.error,
      infoColor: p.info,

      baseColor: p.baseColor,
      bodyColor: p.bodyColor,
      cardColor: p.cardColor,

      textColorBase: p.text1,
      textColor1: p.text1,
      textColor2: p.text2,
      textColor3: p.text3,

      borderColor: p.border,
      borderRadius: '8px',
      fontSize: '14px',
      fontSizeSmall: '12px',
    },
    Layout: {
      siderColor: p.siderColor,
      headerColor: p.headerColor,
      contentColor: p.contentColor,
    },
    Card: {
      borderRadius: '10px',
    },
    Button: {
      borderRadiusMedium: '8px',
      heightMedium: '36px',
    },
    Form: {
      labelTextColor: p.text1,
    },
    Input: {
      color: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
      colorFocus: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
      textColor: p.text1,
      placeholderColor: isDark ? 'rgba(226,232,240,0.62)' : 'rgba(51,65,85,0.62)',
      border: isDark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(15,23,42,0.22)',
      borderHover: isDark ? '1px solid rgba(255,255,255,0.26)' : '1px solid rgba(15,23,42,0.32)',
      borderFocus: isDark
        ? `1px solid ${p.primary}bf`
        : `1px solid ${p.primary}bf`,
      boxShadowFocus: isDark
        ? `0 0 0 2px ${p.primary}33`
        : `0 0 0 2px ${p.primary}2e`,
    },
    DataTable: {
      borderRadius: '10px',
    },
  };
}

