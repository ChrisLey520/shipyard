import { createI18n } from 'vue-i18n';
import zhCN from './messages/zh-CN';
import en from './messages/en';

export function setupI18n() {
  return createI18n({
    legacy: false,
    locale: 'zh-CN',
    fallbackLocale: 'zh-CN',
    messages: {
      'zh-CN': zhCN,
      en,
    },
  });
}
