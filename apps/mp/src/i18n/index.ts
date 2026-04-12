import { createI18n } from 'vue-i18n';
import zhCN from './messages/zh-CN';
import en from './messages/en';

/** 单例：供 App 外（如 composable）使用 i18n.global.t / locale */
export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
});

export function setupI18n() {
  return i18n;
}
