/** 组织 URL 标识（slug）领域规则 */

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export class OrgSlugRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgSlugRuleError';
  }
}

export function assertValidOrgSlug(raw: string): string {
  const next = raw.trim();
  if (next.length < 1 || next.length > 64 || !SLUG_PATTERN.test(next)) {
    throw new OrgSlugRuleError('URL 标识仅允许小写字母、数字和连字符，长度 1–64');
  }
  return next;
}
