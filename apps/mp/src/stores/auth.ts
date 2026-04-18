import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type AuthUser } from '@/api/auth';
import { storage } from '@/utils/storage';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(storage.getAccessToken());
  const refreshToken = ref<string | null>(storage.getRefreshToken());

  const isAuthenticated = computed(() => !!accessToken.value);

  function setTokens(tokens: { accessToken: string; refreshToken: string }) {
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    storage.setTokens(tokens.accessToken, tokens.refreshToken);
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    storage.clearTokens();
  }

  /** 登录/注册后拉取资料：失败时清会话并向上抛出，便于页面结束 loading 且走全局错误提示 */
  async function fetchMeOrThrow() {
    try {
      user.value = await authApi.me();
    } catch (e) {
      clearTokens();
      throw e;
    }
  }

  async function login(email: string, password: string) {
    const tokens = await authApi.login({ email, password });
    setTokens(tokens);
    await fetchMeOrThrow();
  }

  async function register(name: string, email: string, password: string) {
    const tokens = await authApi.register({ name, email, password });
    setTokens(tokens);
    await fetchMeOrThrow();
  }

  async function logout() {
    if (refreshToken.value) {
      await authApi.logout(refreshToken.value).catch(() => undefined);
    }
    clearTokens();
  }

  async function fetchMe() {
    try {
      user.value = await authApi.me();
    } catch {
      clearTokens();
    }
  }

  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshToken.value) return null;
    try {
      const tokens = await authApi.refresh(refreshToken.value);
      setTokens(tokens);
      return tokens.accessToken;
    } catch {
      clearTokens();
      return null;
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    login,
    register,
    logout,
    fetchMe,
    refreshAccessToken,
  };
});
