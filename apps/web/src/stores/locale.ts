import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { defaultLocale, i18n, normalizeLocale, type SupportedLocale } from '../i18n';
import { usersApi } from '../api/users';
import { useAuthStore } from './auth';

const STORAGE_KEY = 'locale';

export const useLocaleStore = defineStore('locale', () => {
  const auth = useAuthStore();
  const locale = ref<SupportedLocale>(defaultLocale);

  const options = computed(() => [
    { label: '简体中文', value: 'zh-CN' as const },
    { label: '繁體中文', value: 'zh-TW' as const },
    { label: 'English', value: 'en' as const },
    { label: '日本語', value: 'ja' as const },
  ]);

  function applyLocale(next: SupportedLocale) {
    locale.value = next;
    i18n.global.locale.value = next;
  }

  function initLocale() {
    const fromUser = normalizeLocale(auth.user?.locale ?? null);
    if (fromUser) {
      applyLocale(fromUser);
      localStorage.setItem(STORAGE_KEY, fromUser);
      return;
    }

    const fromStorage = normalizeLocale(localStorage.getItem(STORAGE_KEY));
    if (fromStorage) {
      applyLocale(fromStorage);
      return;
    }

    const fromBrowser = normalizeLocale(navigator.language);
    if (fromBrowser) {
      applyLocale(fromBrowser);
      localStorage.setItem(STORAGE_KEY, fromBrowser);
      return;
    }

    applyLocale(defaultLocale);
  }

  async function setLocale(next: SupportedLocale, opts?: { persistToServer?: boolean }) {
    applyLocale(next);
    localStorage.setItem(STORAGE_KEY, next);

    const persistToServer = opts?.persistToServer ?? true;
    if (!persistToServer) return;
    if (!auth.accessToken) return;

    const saved = await usersApi.updateMyLocale(next);
    if (auth.user) auth.user = { ...auth.user, locale: saved.locale };
  }

  return {
    locale,
    options,
    initLocale,
    setLocale,
  };
});

