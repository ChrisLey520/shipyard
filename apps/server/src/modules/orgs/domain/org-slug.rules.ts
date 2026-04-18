/** 组织 URL 标识（slug）领域规则 */

import {
  URL_SLUG_MAX_LENGTH,
  URL_SLUG_PATTERN,
  URL_SLUG_VALIDATION_MESSAGE,
} from '@shipyard/shared';

export class OrgSlugRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgSlugRuleError';
  }
}

export function assertValidOrgSlug(raw: string): string {
  const next = raw.trim();
  if (next.length < 1 || next.length > URL_SLUG_MAX_LENGTH || !URL_SLUG_PATTERN.test(next)) {
    throw new OrgSlugRuleError(URL_SLUG_VALIDATION_MESSAGE);
  }
  return next;
}
