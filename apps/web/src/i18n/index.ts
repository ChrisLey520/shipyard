import { createI18n } from 'vue-i18n';
import { zhCN } from './messages/zh-CN';
import { zhTW } from './messages/zh-TW';
import { en } from './messages/en';
import { ja } from './messages/ja';

export const supportedLocales = ['zh-CN', 'zh-TW', 'en', 'ja'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = 'zh-CN';

export function normalizeLocale(input: string | null | undefined): SupportedLocale | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Normalize common patterns, keep it side-effect free.
  const lower = raw.toLowerCase();
  if (lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-hans')) return 'zh-CN';
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hant') || lower.startsWith('zh-hk')) return 'zh-TW';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'ja' || lower.startsWith('ja-') || lower.startsWith('jp')) return 'ja';

  if ((supportedLocales as readonly string[]).includes(raw)) return raw as SupportedLocale;
  return null;
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
  fallbackLocale: ['zh-CN', 'zh-TW', 'en', 'ja'],
  messages,
});

