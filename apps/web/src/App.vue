<template>
  <n-config-provider
    :theme="theme"
    :theme-overrides="themeOverrides"
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
</template>

<script setup lang="ts">
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  darkTheme,
  zhCN,
  dateZhCN,
  type GlobalThemeOverrides,
} from 'naive-ui';
import { usePreferredDark } from '@vueuse/core';
import { computed } from 'vue';

const isDark = usePreferredDark();
const theme = computed(() => (isDark.value ? darkTheme : null));

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: '#16a34a',
    primaryColorHover: '#22c55e',
    primaryColorPressed: '#15803d',

    successColor: '#16a34a',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    infoColor: '#3b82f6',

    baseColor: isDark.value ? '#0b1220' : '#ffffff',
    bodyColor: isDark.value ? '#0b1220' : '#f6f8fa',
    cardColor: isDark.value ? '#0f1b2e' : '#ffffff',

    textColorBase: isDark.value ? '#e6edf3' : '#0f172a',
    textColor1: isDark.value ? '#e6edf3' : '#0f172a',
    textColor2: isDark.value ? '#cbd5e1' : '#334155',
    textColor3: isDark.value ? '#94a3b8' : '#64748b',

    borderColor: isDark.value ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.14)',
    borderRadius: '8px',
    fontSize: '14px',
    fontSizeSmall: '12px',
  },
  Layout: {
    siderColor: isDark.value ? '#0a1426' : '#ffffff',
    headerColor: isDark.value ? '#0a1426' : '#ffffff',
    contentColor: isDark.value ? '#0b1220' : '#f6f8fa',
  },
  Card: {
    borderRadius: '10px',
  },
  Button: {
    borderRadiusMedium: '8px',
    heightMedium: '36px',
  },
  Form: {
    labelTextColor: isDark.value ? '#e2e8f0' : '#0f172a',
  },
  Input: {
    color: isDark.value ? 'rgba(255,255,255,0.06)' : '#ffffff',
    colorFocus: isDark.value ? 'rgba(255,255,255,0.08)' : '#ffffff',
    textColor: isDark.value ? '#e6edf3' : '#0f172a',
    placeholderColor: isDark.value ? 'rgba(226,232,240,0.62)' : 'rgba(51,65,85,0.62)',
    border: isDark.value ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(15,23,42,0.22)',
    borderHover: isDark.value ? '1px solid rgba(255,255,255,0.26)' : '1px solid rgba(15,23,42,0.32)',
    borderFocus: isDark.value ? '1px solid rgba(16,185,129,0.75)' : '1px solid rgba(5,150,105,0.75)',
    boxShadowFocus: isDark.value ? '0 0 0 2px rgba(16,185,129,0.20)' : '0 0 0 2px rgba(5,150,105,0.18)',
  },
  DataTable: {
    borderRadius: '10px',
  },
}));
</script>
