/**
 * 格式化毫秒为人类可读时长
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return `${m}m ${remaining}s`;
}

/**
 * 从 UUID 提取前 8 位 hex，用于 PR Preview URL 生成
 */
export function shortId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 8);
}

/**
 * 构造 PR Preview 子域名
 */
export function buildPreviewSubdomain(prNumber: number, projectId: string): string {
  return `pr-${prNumber}-${shortId(projectId)}`;
}

/**
 * 构造 Git clone HTTPS URL（根据 provider 拼接凭证）
 */
export function buildCloneUrl(
  provider: string,
  repoFullName: string,
  token: string,
  username?: string,
): string {
  switch (provider) {
    case 'gitee':
      return `https://${username ?? 'oauth2'}:${token}@gitee.com/${repoFullName}.git`;
    case 'gitea':
      return `https://${username ?? 'oauth2'}:${token}@${repoFullName}.git`;
    case 'gitlab':
      return `https://oauth2:${token}@gitlab.com/${repoFullName}.git`;
    case 'github':
    default:
      return `https://oauth2:${token}@github.com/${repoFullName}.git`;
  }
}

/**
 * 检查 IP 是否为私有地址（用于 SSRF 过滤）
 * 注意：完整的 IPv6 校验在 server 端用 net 模块实现
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === undefined || b === undefined) return false;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

/**
 * 将日期格式化为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
