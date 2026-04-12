/** 小程序端 token 存储（对齐 Web localStorage 键名，便于后端一致） */
const K_ACCESS = 'accessToken';
const K_REFRESH = 'refreshToken';
const K_ORG_SLUG = 'currentOrgSlug';

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
};
