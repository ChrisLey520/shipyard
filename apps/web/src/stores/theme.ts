import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { usePreferredDark } from '@vueuse/core';
import type { ColorMode, ThemeId } from '../theme/themes';
import { createNaiveOverrides, getNaiveTheme } from '../theme/themes';
import { createAppCssVars } from '../theme/appVars';
import { useAuthStore } from './auth';
import { usersApi } from '../api/users';

const LS_THEME_ID = 'shipyard.themeId';
const LS_COLOR_MODE = 'shipyard.colorMode';

function readThemeId(): ThemeId {
  const v = localStorage.getItem(LS_THEME_ID);
  if (v === 'fresh' || v === 'ocean' || v === 'violet') return v;
  return 'fresh';
}

function readColorMode(): ColorMode {
  const v = localStorage.getItem(LS_COLOR_MODE);
  if (v === 'auto' || v === 'light' || v === 'dark') return v;
  return 'auto';
}

export const useThemeStore = defineStore('theme', () => {
  const preferredDark = usePreferredDark();

  const themeId = ref<ThemeId>(readThemeId());
  const colorMode = ref<ColorMode>(readColorMode());

  const isDark = computed(() => {
    if (colorMode.value === 'dark') return true;
    if (colorMode.value === 'light') return false;
    return preferredDark.value;
  });

  const naiveTheme = computed(() => getNaiveTheme(isDark.value));
  const themeOverrides = computed(() => createNaiveOverrides(themeId.value, isDark.value));
  const appCssVars = computed(() => createAppCssVars(themeId.value, isDark.value));

  /** 登录后 /auth/me 带回的偏好覆盖本地（仅当服务端字段非空） */
  function applyFromUserProfile(u: { themeId?: string | null; colorMode?: string | null }) {
    let touched = false;
    if (u.themeId === 'fresh' || u.themeId === 'ocean' || u.themeId === 'violet') {
      themeId.value = u.themeId;
      localStorage.setItem(LS_THEME_ID, u.themeId);
      touched = true;
    }
    if (u.colorMode === 'auto' || u.colorMode === 'light' || u.colorMode === 'dark') {
      colorMode.value = u.colorMode;
      localStorage.setItem(LS_COLOR_MODE, u.colorMode);
      touched = true;
    }
    return touched;
  }

  async function persistThemeRemote() {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) return;
    try {
      await usersApi.updateMe({
        themeId: themeId.value,
        colorMode: colorMode.value,
      });
      await auth.fetchMe();
    } catch {
      /* axios 全局已提示 */
    }
  }

  function setThemeId(next: ThemeId) {
    themeId.value = next;
    localStorage.setItem(LS_THEME_ID, next);
    void persistThemeRemote();
  }

  function setColorMode(next: ColorMode) {
    colorMode.value = next;
    localStorage.setItem(LS_COLOR_MODE, next);
    void persistThemeRemote();
  }

  function toggleMode() {
    setColorMode(isDark.value ? 'light' : 'dark');
  }

  function hydrateFromStorage() {
    themeId.value = readThemeId();
    colorMode.value = readColorMode();
  }

  return {
    themeId,
    colorMode,
    isDark,
    naiveTheme,
    themeOverrides,
    appCssVars,
    applyFromUserProfile,
    setThemeId,
    setColorMode,
    toggleMode,
    hydrateFromStorage,
  };
});
