import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useThemeStore } from '@/stores/theme';
import {
  authPageDarkBackground,
  authRegisterPageDarkBackground,
  darkCardBackground,
} from '@/theme/darkPalette';

/** 登录/注册等独立页的深色 class 与根样式（与 Wot dark、主题色相一致） */
export function useAuthDarkRoot(options?: { variant?: 'login' | 'register' }) {
  const variant = options?.variant ?? 'login';
  const themeStore = useThemeStore();
  const { isDark, themeId } = storeToRefs(themeStore);

  const authRootStyle = computed(() => {
    if (!isDark.value) return {};
    const id = themeId.value;
    const bg =
      variant === 'register' ? authRegisterPageDarkBackground[id] : authPageDarkBackground[id];
    return {
      background: bg,
      '--auth-card-bg': darkCardBackground[id],
    } as Record<string, string>;
  });

  return { isDark, authRootStyle };
}
