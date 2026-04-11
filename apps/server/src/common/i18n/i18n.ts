import { type ErrorCode, type SupportedLocale, fallbackLocaleChain } from '@shipyard/shared';

export type { SupportedLocale };

type Dict = Record<SupportedLocale, string>;

const errorMessages: Record<ErrorCode, Dict> = {
  ORG_NOT_FOUND: {
    'zh-CN': '组织不存在',
    'zh-TW': '組織不存在',
    en: 'Organization not found',
    ja: '組織が見つかりません',
  },
  ORG_NOT_MEMBER: {
    'zh-CN': '你不是该组织成员',
    'zh-TW': '你不是該組織成員',
    en: 'You are not a member of this organization',
    ja: 'この組織のメンバーではありません',
  },
  ORG_PERMISSION_DENIED: {
    'zh-CN': '权限不足',
    'zh-TW': '權限不足',
    en: 'Insufficient permissions',
    ja: '権限がありません',
  },
};

export function tError(code: ErrorCode, locale: SupportedLocale): string {
  const dict = errorMessages[code];
  if (!dict) return String(code);
  for (const l of [locale, ...fallbackLocaleChain]) {
    const msg = dict[l];
    if (msg) return msg;
  }
  return String(code);
}
