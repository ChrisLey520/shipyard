/**
 * 组织/项目等共用的 URL 路径段 slug 规则（与后端领域校验对齐）。
 */

export const URL_SLUG_MAX_LENGTH = 64;

export const URL_SLUG_PATTERN = /^[a-z0-9-]+$/;

/** 与 assertValidProjectSlug / assertValidOrgSlug 抛错文案一致 */
export const URL_SLUG_VALIDATION_MESSAGE =
  'URL 标识仅允许小写字母、数字和连字符，长度 1–64';

export function isValidUrlSlug(raw: string): boolean {
  const next = raw.trim();
  return next.length >= 1 && next.length <= URL_SLUG_MAX_LENGTH && URL_SLUG_PATTERN.test(next);
}

/**
 * 从展示名称生成 slug 草稿（小写、非字母数字压成连字符），不保证通过 isValidUrlSlug。
 */
export function slugifyFromDisplayName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
