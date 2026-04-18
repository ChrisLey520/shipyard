import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import 'virtual:uno.css';
import './styles/page-responsive.css';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import { useLocaleStore } from './stores/locale';
import { setupMonitoring } from './lib/setupMonitoring';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(i18n);
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  },
});

useLocaleStore(pinia).initLocale();
setupMonitoring(app);
app.mount('#app');
