/** 小程序端 token 存储（对齐 Web localStorage 键名，便于后端一致） */
const K_ACCESS = 'accessToken';
const K_REFRESH = 'refreshToken';
const K_ORG_SLUG = 'currentOrgSlug';
const K_LOCALE = 'appLocale';
/** 与 Web 端 localStorage 键名一致，便于多端习惯对齐 */
const K_THEME_ID = 'shipyard.themeId';
const K_COLOR_MODE = 'shipyard.colorMode';

export const storage = {
  getAccessToken(): string | null {
    try {
      return uni.getStorageSync(K_ACCESS) || null;
    } catch {
      return null;
    }
  },
  getRefreshToken(): string | null {
    try {
      return uni.getStorageSync(K_REFRESH) || null;
    } catch {
      return null;
    }
  },
  setTokens(access: string, refresh: string) {
    uni.setStorageSync(K_ACCESS, access);
    uni.setStorageSync(K_REFRESH, refresh);
  },
  clearTokens() {
    try {
      uni.removeStorageSync(K_ACCESS);
      uni.removeStorageSync(K_REFRESH);
    } catch {
      /* ignore */
    }
  },
  getCurrentOrgSlug(): string | null {
    try {
      return uni.getStorageSync(K_ORG_SLUG) || null;
    } catch {
      return null;
    }
  },
  setCurrentOrgSlug(slug: string) {
    uni.setStorageSync(K_ORG_SLUG, slug);
  },

  getLocale(): 'zh-CN' | 'en' | null {
    try {
      const v = uni.getStorageSync(K_LOCALE) as string | undefined;
      if (v === 'en' || v === 'zh-CN') return v;
      return null;
    } catch {
      return null;
    }
  },

  setLocale(locale: 'zh-CN' | 'en') {
    uni.setStorageSync(K_LOCALE, locale);
  },

  clearLocale() {
    try {
      uni.removeStorageSync(K_LOCALE);
    } catch {
      /* ignore */
    }
  },

  getThemeId(): 'fresh' | 'ocean' | 'violet' | null {
    try {
      const v = uni.getStorageSync(K_THEME_ID) as string | undefined;
      if (v === 'fresh' || v === 'ocean' || v === 'violet') return v;
      return null;
    } catch {
      return null;
    }
  },

  setThemeId(id: 'fresh' | 'ocean' | 'violet') {
    uni.setStorageSync(K_THEME_ID, id);
  },

  getColorMode(): 'auto' | 'light' | 'dark' | null {
    try {
      const v = uni.getStorageSync(K_COLOR_MODE) as string | undefined;
      if (v === 'auto' || v === 'light' || v === 'dark') return v;
      return null;
    } catch {
      return null;
    }
  },

  setColorMode(mode: 'auto' | 'light' | 'dark') {
    uni.setStorageSync(K_COLOR_MODE, mode);
  },
};
