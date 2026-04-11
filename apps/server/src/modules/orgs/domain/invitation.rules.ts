/** 组织邀请领域规则 */

export class InvitationRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvitationRuleError';
  }
}

/** 规范化受邀邮箱（trim + 小写），并做最小合法性检查 */
export function normalizeInviteEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (e.length < 3 || !e.includes('@') || e.startsWith('@') || e.endsWith('@')) {
    throw new InvitationRuleError('邮箱格式无效');
  }
  return e;
}
