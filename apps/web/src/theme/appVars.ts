import type { ThemeId } from './themes';

function rgbTriplet(hex: string): string {
  const h = hex.replace('#', '').trim();
  const s = h.length === 3
    ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
    : h;
  const n = Number.parseInt(s, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}

type AppVars = Record<string, string>;

export function createAppCssVars(themeId: ThemeId, isDark: boolean): AppVars {
  if (!isDark) {
    if (themeId === 'fresh') {
      return {
        '--app-accent-1': rgbTriplet('#22c55e'),
        '--app-accent-2': rgbTriplet('#38bdf8'),
        '--app-grid-line': 'rgba(15,23,42,0.045)',
      };
    }
    if (themeId === 'ocean') {
      return {
        '--app-accent-1': rgbTriplet('#0ea5e9'),
        '--app-accent-2': rgbTriplet('#22c55e'),
        '--app-grid-line': 'rgba(15,23,42,0.045)',
      };
    }
    return {
      '--app-accent-1': rgbTriplet('#8b5cf6'),
      '--app-accent-2': rgbTriplet('#38bdf8'),
      '--app-grid-line': 'rgba(15,23,42,0.045)',
    };
  }

  if (themeId === 'fresh') {
    return {
      '--app-accent-1': rgbTriplet('#22c55e'),
      '--app-accent-2': rgbTriplet('#38bdf8'),
      // 深色网格线随主题色相微调，与 Naive body 色温一致
      '--app-grid-line': 'rgba(74, 222, 128, 0.07)',
    };
  }
  if (themeId === 'ocean') {
    return {
      '--app-accent-1': rgbTriplet('#38bdf8'),
      '--app-accent-2': rgbTriplet('#a78bfa'),
      '--app-grid-line': 'rgba(56, 189, 248, 0.08)',
    };
  }
  return {
    '--app-accent-1': rgbTriplet('#a78bfa'),
    '--app-accent-2': rgbTriplet('#38bdf8'),
    '--app-grid-line': 'rgba(167, 139, 250, 0.08)',
  };
}

