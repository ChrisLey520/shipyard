import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import { setupI18n } from './i18n';
import 'virtual:uno.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  app.use(VueQueryPlugin, { queryClient });
  app.use(setupI18n());
  return { app };
}
