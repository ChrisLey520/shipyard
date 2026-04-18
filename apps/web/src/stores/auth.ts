import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api/auth';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  locale?: string | null;
  themeId?: string | null;
  colorMode?: string | null;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));

  const isAuthenticated = computed(() => !!accessToken.value);

  function setTokens(tokens: { accessToken: string; refreshToken: string }) {
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  /** 登录/注册后拉取资料：失败时清会话并抛出，便于全局错误提示 */
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
      await authApi.logout(refreshToken.value).catch(() => {});
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
    isAuthenticated,
    login,
    register,
    logout,
    fetchMe,
    refreshAccessToken,
  };
});
