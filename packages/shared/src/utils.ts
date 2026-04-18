import { GitProvider } from './enums';

/** 是否为本地回环类主机名（用于部署域名 / SSH host 判断） */
export function isLoopbackHostLabel(s: string | null | undefined): boolean {
  const t = (s ?? '').trim();
  return /^localhost$/i.test(t) || t === '127.0.0.1' || t === '::1';
}

/** 去掉字符串末尾连续斜杠（规范 HTTP(S) base URL） */
export function stripTrailingSlashes(input: string): string {
  return input.replace(/\/+$/, '');
}

/**
 * 将主机名或完整 URL 规范为带末尾斜杠的根访问地址（与部署日志、环境访问 URL 展示一致）。
 * 无 scheme 时补 `http://`；仅空白则返回空串。
 */
export function normalizeHttpRootUrlWithSlash(hostOrUrl: string): string {
  const s = hostOrUrl.trim();
  if (!s) return '';
  const base = s.includes('://') ? s : `http://${s}`;
  return `${stripTrailingSlashes(base)}/`;
}

/** 使用 SSH 目标主机（多为公网 IP）生成的站点根 URL；域名尚未解析时可在浏览器先试此地址 */
export function buildDirectServerSiteAccessUrl(serverSshHost: string | null | undefined): string {
  const h = (serverSshHost ?? '').trim();
  if (!h) return '';
  return normalizeHttpRootUrlWithSlash(h);
}

/** 从规范根 URL 或裸主机名提取 HTTP 主机（不含端口），不依赖 DOM URL（shared 仅 ES2022 lib） */
function extractHttpSiteHost(hostOrRoot: string): string {
  const root = normalizeHttpRootUrlWithSlash(hostOrRoot.trim());
  if (!root) return '';
  const m = /^https?:\/\/([^/?#]+)/i.exec(root);
  if (!m?.[1]) return '';
  let host = m[1];
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end > 1 ? host.slice(1, end) : host;
  }
  const lastColon = host.lastIndexOf(':');
  if (lastColon > 0 && /^\d{1,5}$/.test(host.slice(lastColon + 1))) {
    host = host.slice(0, lastColon);
  }
  return host;
}

/** 两段根 URL（或裸主机名）是否指向同一 HTTP 主机，用于避免重复展示「域名」与「服务器直连」 */
export function isSameHttpSiteHost(hostOrRootA: string, hostOrRootB: string): boolean {
  const a = extractHttpSiteHost(hostOrRootA);
  const b = extractHttpSiteHost(hostOrRootB);
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * PM2 / 本机静态回退站点的根 URL（固定 `http://`，与 deploy 落库 accessUrl、详情页展示一致）。
 * `hostInput` 可为裸主机名、IP，或带 `http(s)://` 前缀（会去掉 scheme 与路径）。
 */
export function buildPm2StaticSiteRootUrl(hostInput: string, port: number): string {
  const raw = hostInput.trim();
  if (!raw || !Number.isFinite(port) || port <= 0 || port > 65535) return '';
  let hostPart = raw.replace(/^https?:\/\//i, '');
  hostPart = hostPart.split('/')[0]?.trim() ?? '';
  if (!hostPart) return '';
  return `http://${hostPart}:${port}/`;
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
 * PR 预览完整主机名（不含协议）
 * @param previewBaseDomain 例如 preview.example.com
 */
export function buildPreviewFqdn(prNumber: number, projectId: string, previewBaseDomain: string): string {
  const sub = buildPreviewSubdomain(prNumber, projectId);
  const base = previewBaseDomain.trim().replace(/^\.+/, '').replace(/\.+$/, '');
  return `${sub}.${base}`;
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
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === undefined || b === undefined) return false;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * 出站 Webhook 等请求禁止解析到的地址（IPv4/IPv6 私网、环回、链路本地、文档地址等）
 */
export function isBlockedOutboundIp(ip: string): boolean {
  const t = ip.trim().replace(/^\[|\]$/g, '');
  if (t.includes(':')) {
    const lower = t.toLowerCase().split('%')[0] ?? '';
    if (lower === '::1') return true;
    // 2001:db8::/32 documentation
    if (lower.startsWith('2001:db8:')) return true;
    // IPv4-mapped ::ffff:x.x.x.x
    if (lower.startsWith('::ffff:')) {
      const rest = lower.slice(7);
      const v4 = rest.includes(':') ? (rest.split(':').pop() ?? '') : rest;
      if (v4 && isPrivateIpv4(v4)) return true;
    }
    const firstSeg = lower.split(':').find((s) => s.length > 0) ?? '';
    if (firstSeg) {
      const n = parseInt(firstSeg, 16);
      if (!Number.isNaN(n)) {
        // fe80::/10
        if (n >= 0xfe80 && n <= 0xfebf) return true;
        // fc00::/7 unique local
        if (n >= 0xfc00 && n <= 0xfdff) return true;
      }
    }
    return false;
  }
  return isPrivateIpv4(t);
}

/**
 * 将日期格式化为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
