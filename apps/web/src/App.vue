<template>
  <div :style="themeStore.appCssVars">
    <n-config-provider
      :theme="themeStore.naiveTheme"
      :theme-overrides="themeStore.themeOverrides"
      :locale="zhCN"
      :date-locale="dateZhCN"
    >
      <n-global-style />
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <router-view />
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
} from 'naive-ui';
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();
</script>
