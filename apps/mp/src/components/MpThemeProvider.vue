<template>
  <wd-config-provider :theme="wdTheme" :theme-vars="wotThemeVars" custom-class="mp-theme-cfg-root">
    <view class="mp-theme-surface" :class="surfaceClass" :style="surfaceStyle">
      <slot />
    </view>
  </wd-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useThemeStore } from '@/stores/theme';
import { darkBodyBackground } from '@/theme/darkPalette';

const themeStore = useThemeStore();
const { wdTheme, wotThemeVars, isDark, themeId } = storeToRefs(themeStore);

const surfaceClass = computed(() =>
  isDark.value ? 'mp-theme-surface mp-theme-surface--dark' : 'mp-theme-surface mp-theme-surface--light',
);

const surfaceStyle = computed(() => {
  if (!isDark.value) return {};
  return { backgroundColor: darkBodyBackground[themeId.value] };
});
</script>

<style scoped>
/* 用实色铺满可视区；勿仅叠透明渐变，否则会透出 App.vue 里 page 的固定浅色底 */
.mp-theme-surface {
  min-height: 100vh;
  box-sizing: border-box;
}

.mp-theme-surface--light {
  background-color: #eaedf6;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, transparent 36%);
}

.mp-theme-surface--dark {
  /* 实色由 surfaceStyle 按 themeId 注入，与 Web 深色底一致 */
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 42%);
}
</style>
