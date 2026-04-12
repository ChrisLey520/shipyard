import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useThemeStore } from '@/stores/theme';
import { darkBodyBackground } from '@/theme/darkPalette';

/**
 * 自定义导航栏后仍保留 page-meta：窗口/根背景与主题一致，减轻下拉与 resize 露底
 */
export function useMpPageRootMeta() {
  const { isDark, themeId } = storeToRefs(useThemeStore());
  const pageMetaBg = computed(() =>
    isDark.value ? darkBodyBackground[themeId.value] : '#eaedf6',
  );
  const pageMetaBgText = computed(() => (isDark.value ? 'light' : 'dark'));
  return { pageMetaBg, pageMetaBgText };
}
