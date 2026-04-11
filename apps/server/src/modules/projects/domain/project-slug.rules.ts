/** 项目 URL 标识（slug）领域规则，无 Nest/Prisma 依赖 */

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export class ProjectSlugRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectSlugRuleError';
  }
}

/** 校验 slug；合法则返回 trim 后的 slug，否则抛 ProjectSlugRuleError */
export function assertValidProjectSlug(raw: string): string {
  const next = raw.trim();
  if (next.length < 1 || next.length > 64 || !SLUG_PATTERN.test(next)) {
    throw new ProjectSlugRuleError('URL 标识仅允许小写字母、数字和连字符，长度 1–64');
  }
  return next;
}
