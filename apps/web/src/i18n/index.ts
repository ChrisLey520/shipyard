import { createI18n } from 'vue-i18n';
import {
  defaultLocale,
  fallbackLocaleChain,
  parseSupportedLocale,
  supportedLocales,
  type SupportedLocale,
} from '@shipyard/shared';
import { zhCN } from './messages/zh-CN';
import { zhTW } from './messages/zh-TW';
import { en } from './messages/en';
import { ja } from './messages/ja';

export { defaultLocale, supportedLocales, type SupportedLocale };

export function normalizeLocale(input: string | null | undefined): SupportedLocale | null {
  return parseSupportedLocale(input);
}

export const messages = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
} as const;

export const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: [...fallbackLocaleChain],
  messages,
});
