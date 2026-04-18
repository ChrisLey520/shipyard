import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import MpThemeProvider from '@/components/MpThemeProvider.vue';
import MpCustomNavBar from '@/components/MpCustomNavBar.vue';
import MpMainTabBar from '@/components/MpMainTabBar.vue';
import { useThemeStore } from '@/stores/theme';
import { setupI18n } from './i18n';
import { setupMonitoring } from './lib/setupMonitoring';
import { isUniMiniProgramRuntime } from '@/utils/uniPlatform';
import 'virtual:uno.css';

/** 小程序无浏览器 window；避免 focus/visibility 误触发 refetch 带来多余请求与工具链噪音 */
const isUniMp = isUniMiniProgramRuntime();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      ...(isUniMp ? { refetchOnWindowFocus: false, refetchOnReconnect: false } : {}),
    },
  },
});

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  app.use(VueQueryPlugin, { queryClient });
  app.use(setupI18n());
  app.component('MpThemeProvider', MpThemeProvider);
  app.component('MpCustomNavBar', MpCustomNavBar);
  app.component('MpMainTabBar', MpMainTabBar);
  /** 小程序：同步状态栏等（自定义底栏由组件自绘） */
  if (isUniMp) {
    app.mixin({
      onShow() {
        try {
          useThemeStore().applyNativeChrome();
        } catch {
          /* ignore */
        }
      },
    });
  }
  setupMonitoring(app);
  return { app };
}
