import type { ShipyardDeployAccessMeta } from '@/api/pipeline';
import {
  buildPm2StaticSiteRootUrl,
  normalizeHttpRootUrlWithSlash,
  resolveDeployAccessHost,
  stripTrailingSlashes,
} from '@shipyard/shared';

/** 从部署 configSnapshot 解析 PM2 静态访问元数据 */
export function readShipyardAccess(
  snap: Record<string, unknown> | null | undefined,
): ShipyardDeployAccessMeta | null {
  const raw = snap?.['shipyardAccess'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const port = o['staticPort'];
  const host = o['staticHost'];
  if (typeof port !== 'number' || typeof host !== 'string') return null;
  return { staticPort: port, staticHost: host };
}

/** 详情页「PM2 静态站点」展示 URL（空串表示无） */
export function buildPm2StaticAccessUrlFromSnapshot(
  snap: Record<string, unknown> | null | undefined,
  envDomain: string | null | undefined,
): string {
  const acc = readShipyardAccess(snap);
  if (!acc) return '';
  const host =
    resolveDeployAccessHost(envDomain ?? null, acc.staticHost) || acc.staticHost;
  return buildPm2StaticSiteRootUrl(host, acc.staticPort);
}

/** 主站点访问根 URL（环境域名 + 回环时回退 SSH host） */
export function buildPrimarySiteAccessUrl(
  envDomain: string | null | undefined,
  serverSshHost: string | null | undefined,
): string {
  const d = envDomain?.trim();
  if (!d) return '';
  const host = resolveDeployAccessHost(d, serverSshHost);
  return host ? normalizeHttpRootUrlWithSlash(host) : '';
}

/**
 * 健康检查 / 次要 URL：与主站规范化后相同则不再重复展示。
 */
export function pickSecondaryAccessUrl(primaryUrl: string, healthCheckUrl: string): string {
  const hc = healthCheckUrl.trim();
  if (!hc) return '';
  if (!primaryUrl) return hc;
  if (stripTrailingSlashes(hc) === stripTrailingSlashes(primaryUrl)) return '';
  return hc;
}
