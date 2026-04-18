import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ColorMode, ThemeId } from '@/theme/types';
import { buildWotThemeVars, tabBarSelectedHex } from '@/theme/wotVars';
import { darkBodyBackground, darkHeaderBackground, darkTabBarBackground } from '@/theme/darkPalette';
import { storage } from '@/utils/storage';
import { isCurrentPageTabBar } from '@/utils/tabBarPages';
import { isUniMiniProgramRuntime } from '@/utils/uniPlatform';
import * as usersApi from '@/api/users';

function readHostThemeDark(): boolean {
  try {
    const sys = uni.getSystemInfoSync() as { theme?: string };
    return sys.theme === 'dark';
  } catch {
    return false;
  }
}

export const useThemeStore = defineStore('mpTheme', () => {
  const hostPreferredDark = ref(readHostThemeDark());

  const themeId = ref<ThemeId>(storage.getThemeId() ?? 'fresh');
  const colorMode = ref<ColorMode>(storage.getColorMode() ?? 'auto');

  const isDark = computed(() => {
    if (colorMode.value === 'dark') return true;
    if (colorMode.value === 'light') return false;
    return hostPreferredDark.value;
  });

  const wdTheme = computed(() => (isDark.value ? 'dark' : 'light'));

  const wotThemeVars = computed(() => buildWotThemeVars(themeId.value, isDark.value));

  const accentHex = computed(() => tabBarSelectedHex(themeId.value, isDark.value));

  /** 与 Web 一致：/auth/me 非空字段覆盖本地 storage */
  function applyFromUserProfile(u: { themeId?: string | null; colorMode?: string | null }) {
    let touched = false;
    if (u.themeId === 'fresh' || u.themeId === 'ocean' || u.themeId === 'violet') {
      themeId.value = u.themeId;
      storage.setThemeId(u.themeId);
      touched = true;
    }
    if (u.colorMode === 'auto' || u.colorMode === 'light' || u.colorMode === 'dark') {
      colorMode.value = u.colorMode;
      storage.setColorMode(u.colorMode);
      touched = true;
    }
    if (touched) applyNativeChrome();
  }

  async function persistThemeRemote() {
    // 勿在文件顶层静态 import auth store，避免与 auth/http 链形成循环依赖导致 exports.useThemeStore 未定义。
    // 小程序端动态 import() 易被编译成非法片段；require 须用相对路径（@/ 在产物中不会改写）。
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('./auth') as typeof import('./auth');
    const auth = useAuthStore();
    if (!auth.isAuthenticated) return;
    try {
      await usersApi.updateMe({
        themeId: themeId.value,
        colorMode: colorMode.value,
      });
      await auth.fetchMe();
    } catch {
      /* 全局 request 已提示 */
    }
  }

  function setThemeId(next: ThemeId) {
    themeId.value = next;
    storage.setThemeId(next);
    applyNativeChrome();
    void persistThemeRemote();
  }

  function setColorMode(next: ColorMode) {
    colorMode.value = next;
    storage.setColorMode(next);
    applyNativeChrome();
    void persistThemeRemote();
  }

  function hydrateFromStorage() {
    themeId.value = storage.getThemeId() ?? 'fresh';
    colorMode.value = storage.getColorMode() ?? 'auto';
    hostPreferredDark.value = readHostThemeDark();
    applyNativeChrome();
  }

  function syncHostPreferredDark() {
    hostPreferredDark.value = readHostThemeDark();
    applyNativeChrome();
  }

  /** 微信基础库：跟随系统深浅色变化 */
  function subscribeHostThemeChange() {
    const u = uni as unknown as {
      onThemeChange?: (fn: (res: { theme?: string }) => void) => void;
    };
    if (typeof u.onThemeChange !== 'function') return;
    u.onThemeChange((res) => {
      hostPreferredDark.value = res.theme === 'dark';
      applyNativeChrome();
    });
  }

  /** 原生 TabBar 样式（非微信自定义 tabBar 端使用） */
  function applyTabBarChrome() {
    uni.setTabBarStyle({
      selectedColor: accentHex.value,
      color: isDark.value ? '#94a3b8' : '#666666',
      backgroundColor: isDark.value ? darkTabBarBackground[themeId.value] : '#eaedf6',
      borderStyle: isDark.value ? 'white' : 'black',
    });
  }

  function applyNativeChrome() {
    // 微信小程序：自定义 tabBar 时 setTabBarStyle 会报错，须用运行时判断（勿用 import.meta.env.UNI_PLATFORM）
    if (isUniMiniProgramRuntime()) {
      try {
        const u = uni as unknown as { setStatusBarStyle?: (o: { style: 'dark' | 'light' }) => void };
        u.setStatusBarStyle?.({ style: isDark.value ? 'light' : 'dark' });
      } catch {
        /* 部分端无此 API */
      }
      return;
    }
    if (isCurrentPageTabBar()) {
      try {
        applyTabBarChrome();
      } catch {
        /* ignore */
      }
    }
    try {
      uni.setNavigationBarColor({
        frontColor: isDark.value ? '#ffffff' : '#000000',
        backgroundColor: isDark.value ? darkHeaderBackground[themeId.value] : '#eaedf6',
      });
    } catch {
      /* 无原生导航栏的端会失败 */
    }
    try {
      uni.setBackgroundColor({
        backgroundColor: isDark.value ? darkBodyBackground[themeId.value] : '#eaedf6',
      });
    } catch {
      /* 部分端不支持 */
    }
  }

  return {
    themeId,
    colorMode,
    hostPreferredDark,
    isDark,
    wdTheme,
    wotThemeVars,
    accentHex,
    applyFromUserProfile,
    setThemeId,
    setColorMode,
    hydrateFromStorage,
    syncHostPreferredDark,
    subscribeHostThemeChange,
    applyNativeChrome,
  };
});
