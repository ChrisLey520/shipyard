<template>
  <div :style="themeStore.appCssVars">
    <n-config-provider
      :theme="themeStore.naiveTheme"
      :theme-overrides="themeStore.themeOverrides"
      :locale="naiveLocale"
      :date-locale="naiveDateLocale"
    >
      <n-global-style />
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <router-view />
            <destructive-name-confirm-host />
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
  zhTW,
  dateZhTW,
  enUS,
  dateEnUS,
  jaJP,
  dateJaJP,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import DestructiveNameConfirmHost from './components/DestructiveNameConfirmHost.vue';
import { useThemeStore } from './stores/theme';
import { useAuthStore } from './stores/auth';
import type { SupportedLocale } from './i18n';

const themeStore = useThemeStore();
const auth = useAuthStore();

watch(
  () => auth.user,
  (u) => {
    if (!u) return;
    themeStore.applyFromUserProfile({
      themeId: u.themeId ?? null,
      colorMode: u.colorMode ?? null,
    });
  },
  { immediate: true },
);

const { locale } = useI18n();

const naiveLocale = computed(() => {
  switch (locale.value as SupportedLocale) {
    case 'zh-CN':
      return zhCN;
    case 'zh-TW':
      return zhTW;
    case 'en':
      return enUS;
    case 'ja':
      return jaJP;
    default:
      return zhCN;
  }
});

const naiveDateLocale = computed(() => {
  switch (locale.value as SupportedLocale) {
    case 'zh-CN':
      return dateZhCN;
    case 'zh-TW':
      return dateZhTW;
    case 'en':
      return dateEnUS;
    case 'ja':
      return dateJaJP;
    default:
      return dateZhCN;
  }
});
</script>
