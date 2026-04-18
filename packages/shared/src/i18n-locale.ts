/**
 * 契约：前后端共用的语言列表、回退链与解析（无框架依赖）。
 */

export const supportedLocales = ['zh-CN', 'zh-TW', 'en', 'ja'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = 'zh-CN';

/** 消息回退顺序（与 supportedLocales 顺序一致） */
export const fallbackLocaleChain: SupportedLocale[] = [...supportedLocales];

/**
 * 将任意输入解析为支持的语言标签；无法识别时返回 null。
 */
export function parseSupportedLocale(input: unknown): SupportedLocale | null {
  if (input == null) return null;
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-hans')) return 'zh-CN';
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hant') || lower.startsWith('zh-hk')) return 'zh-TW';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'ja' || lower.startsWith('ja-') || lower.startsWith('jp')) return 'ja';

  if ((supportedLocales as readonly string[]).includes(raw)) return raw as SupportedLocale;
  return null;
}

/**
 * 解析语言；无法识别时回退到 fallback（默认 defaultLocale）。供服务端等需保证始终有合法 locale 的场景。
 */
export function resolveSupportedLocale(
  input: unknown,
  fallback: SupportedLocale = defaultLocale,
): SupportedLocale {
  return parseSupportedLocale(input) ?? fallback;
}
