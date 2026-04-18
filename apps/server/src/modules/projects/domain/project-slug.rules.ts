/** 项目 URL 标识（slug）领域规则，无 Nest/Prisma 依赖 */

import {
  URL_SLUG_MAX_LENGTH,
  URL_SLUG_PATTERN,
  URL_SLUG_VALIDATION_MESSAGE,
} from '@shipyard/shared';

export class ProjectSlugRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectSlugRuleError';
  }
}

/** 校验 slug；合法则返回 trim 后的 slug，否则抛 ProjectSlugRuleError */
export function assertValidProjectSlug(raw: string): string {
  const next = raw.trim();
  if (next.length < 1 || next.length > URL_SLUG_MAX_LENGTH || !URL_SLUG_PATTERN.test(next)) {
    throw new ProjectSlugRuleError(URL_SLUG_VALIDATION_MESSAGE);
  }
  return next;
}
