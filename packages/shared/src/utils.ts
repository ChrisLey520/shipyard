import { GitProvider } from './enums';

/** 是否为本地回环类主机名（用于部署域名 / SSH host 判断） */
export function isLoopbackHostLabel(s: string | null | undefined): boolean {
  const t = (s ?? '').trim();
  return /^localhost$/i.test(t) || t === '127.0.0.1' || t === '::1';
}

/**
 * 环境「域名」为 localhost/127.0.0.1 且 SSH 目标非本机时，返回服务器 host 作为对外访问主机与 Nginx server_name；
 * 避免用户在本机浏览器访问 localhost 却访问不到远端已部署站点。
 */
export function resolveDeployAccessHost(
  envDomain: string | null | undefined,
  serverSshHost: string | null | undefined,
): string {
  const d = (envDomain ?? '').trim();
  const h = (serverSshHost ?? '').trim();
  if (!d) return '';
  const domainIsLoopback = isLoopbackHostLabel(d);
  const hostIsLoopback = !h || isLoopbackHostLabel(h);
  if (domainIsLoopback && !hostIsLoopback) return h;
  return d;
}

/**
 * Nginx `server_name` 空格分隔列表：本机填 localhost 时同时写入 localhost、127.0.0.1、::1，
 * 避免仅用 localhost 时浏览器访问 http://127.0.0.1 不命中；SSH 使用局域网 IP 时一并加入。
 */
export function buildNginxServerNameList(envDomain: string, sshHost: string): string {
  const d = envDomain.trim();
  const h = (sshHost ?? '').trim();
  const set = new Set<string>();

  if (isLoopbackHostLabel(d)) {
    set.add('localhost');
    set.add('127.0.0.1');
    set.add('::1');
  } else {
    set.add(resolveDeployAccessHost(d, h) || d);
  }

  if (h && !isLoopbackHostLabel(h)) {
    set.add(h);
  }

  return [...set].join(' ');
}

/** 部署状态展示文案 key（用于 i18n） */
export function deploymentStatusKey(status: string | null | undefined): string {
  switch (status) {
    case 'pending_approval':
      return 'pipeline.status.pendingApproval';
    case 'queued':
      return 'pipeline.status.queued';
    case 'building':
      return 'pipeline.status.building';
    case 'deploying':
      return 'pipeline.status.deploying';
    case 'success':
      return 'pipeline.status.success';
    case 'failed':
      return 'pipeline.status.failed';
    case 'cancelled':
      return 'pipeline.status.cancelled';
    case 'skipped':
      return 'pipeline.status.skipped';
    default:
      return 'common.unknown';
  }
}

/** 触发方式展示文案 key（用于 i18n） */
export function deploymentTriggerKey(trigger: string | null | undefined): string {
  switch (trigger) {
    case 'manual':
      return 'pipeline.trigger.manual';
    case 'webhook':
      return 'pipeline.trigger.webhook';
    case 'rollback':
      return 'pipeline.trigger.rollback';
    default:
      return 'common.unknown';
  }
}

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
    case GitProvider.GITEE:
      return `https://${username ?? 'oauth2'}:${token}@gitee.com/${repoFullName}.git`;
    case GitProvider.GITEA:
      return `https://${username ?? 'oauth2'}:${token}@${repoFullName}.git`;
    case GitProvider.GITLAB:
      return `https://oauth2:${token}@gitlab.com/${repoFullName}.git`;
    case GitProvider.GITHUB:
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
