import { readdirSync, statSync, rmSync, existsSync } from 'fs';
import * as path from 'path';
import type { Logger } from '@nestjs/common';

/** 默认缓存上限 5GiB（可通过 SHIPYARD_BUILD_DEPS_CACHE_MAX_BYTES 覆盖） */
export const DEFAULT_CACHE_MAX_BYTES = 5 * 1024 * 1024 * 1024;

export function resolveCacheMaxBytes(): number {
  const raw = process.env['SHIPYARD_BUILD_DEPS_CACHE_MAX_BYTES']?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  const mb = process.env['SHIPYARD_BUILD_DEPS_CACHE_MAX_MB']?.trim();
  if (mb && /^\d+$/.test(mb)) {
    const n = Number(mb);
    if (n > 0) return n * 1024 * 1024;
  }
  return DEFAULT_CACHE_MAX_BYTES;
}

/** 未设置或非法时返回 null，表示不启用 TTL 淘汰 */
export function resolveCacheMaxAgeDays(): number | null {
  const raw = process.env['SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS']?.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n <= 0) return null;
  return n;
}

/** 单组织子树最大字节；未设置返回 null */
export function resolveCacheOrgMaxBytes(): number | null {
  const raw = process.env['SHIPYARD_BUILD_DEPS_CACHE_ORG_MAX_BYTES']?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  const mb = process.env['SHIPYARD_BUILD_DEPS_CACHE_ORG_MAX_MB']?.trim();
  if (mb && /^\d+$/.test(mb)) {
    const n = Number(mb);
    if (n > 0) return n * 1024 * 1024;
  }
  return null;
}

/** 指纹目录：…/orgId/pm/fingerprint（其下含 node_modules） */
function listFingerprintDirs(cacheRoot: string): string[] {
  if (!existsSync(cacheRoot)) return [];
  const out: string[] = [];
  for (const org of readdirSafe(cacheRoot)) {
    const orgP = path.join(cacheRoot, org);
    if (!isDir(orgP)) continue;
    for (const pm of readdirSafe(orgP)) {
      const pmP = path.join(orgP, pm);
      if (!isDir(pmP)) continue;
      for (const fp of readdirSafe(pmP)) {
        const fpP = path.join(pmP, fp);
        if (!isDir(fpP)) continue;
        const nm = path.join(fpP, 'node_modules');
        if (existsSync(nm) && isDir(nm)) out.push(fpP);
      }
    }
  }
  return out;
}

/** 仅某一 orgId 下的指纹目录 */
function listFingerprintDirsForOrg(cacheRoot: string, orgId: string): string[] {
  return listFingerprintDirs(cacheRoot).filter((d) => d.startsWith(path.join(cacheRoot, orgId) + path.sep));
}

function readdirSafe(p: string): string[] {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function dirSizeBytes(dir: string): number {
  let total = 0;
  const walk = (d: string) => {
    for (const name of readdirSafe(d)) {
      const f = path.join(d, name);
      try {
        const st = statSync(f);
        if (st.isDirectory()) walk(f);
        else total += st.size;
      } catch {
        /* skip */
      }
    }
  };
  walk(dir);
  return total;
}

export function totalDepsCacheBytes(cacheRoot: string): number {
  return listFingerprintDirs(cacheRoot).reduce((sum, d) => sum + dirSizeBytes(d), 0);
}

function totalOrgDepsCacheBytes(cacheRoot: string, orgId: string): number {
  return listFingerprintDirsForOrg(cacheRoot, orgId).reduce((sum, d) => sum + dirSizeBytes(d), 0);
}

/**
 * 删除 mtime 早于「现在 − maxAgeDays」的指纹目录（整目录删除）。
 */
export function evictDepsCacheTtl(cacheRoot: string, maxAgeDays: number, logger: Logger): void {
  if (!existsSync(cacheRoot) || maxAgeDays <= 0) return;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  for (const dir of listFingerprintDirs(cacheRoot)) {
    let mtime: number;
    try {
      mtime = statSync(dir).mtimeMs;
    } catch {
      continue;
    }
    if (mtime >= cutoff) continue;
    const size = dirSizeBytes(dir);
    try {
      rmSync(dir, { recursive: true, force: true });
      logger.log(`[build-cache] cache_evict_ttl freed ~${size} bytes (${dir})`);
    } catch (err) {
      logger.warn(`[build-cache] cache_evict_ttl failed ${dir}: ${err}`);
    }
  }
}

/**
 * 超过上限时按指纹目录 mtime 最旧优先删除，直至总占用低于 maxBytes。
 */
export function evictDepsCacheLru(cacheRoot: string, maxBytes: number, logger: Logger): void {
  if (!existsSync(cacheRoot) || maxBytes <= 0) return;

  let total = totalDepsCacheBytes(cacheRoot);
  if (total <= maxBytes) return;

  const entries = listFingerprintDirs(cacheRoot).map((dir) => ({
    dir,
    mtime: statSync(dir).mtimeMs,
    size: dirSizeBytes(dir),
  }));
  entries.sort((a, b) => a.mtime - b.mtime);

  for (const e of entries) {
    if (total <= maxBytes) break;
    try {
      rmSync(e.dir, { recursive: true, force: true });
      total -= e.size;
      logger.log(`[build-cache] cache_evict freed ~${e.size} bytes (${e.dir})`);
    } catch (err) {
      logger.warn(`[build-cache] cache_evict failed ${e.dir}: ${err}`);
    }
  }
}

/**
 * 仅针对 orgId 子树：超过 orgMaxBytes 时按 mtime LRU 淘汰该组织下指纹目录。
 */
export function evictOrgDepsCacheLru(
  cacheRoot: string,
  orgId: string,
  orgMaxBytes: number,
  logger: Logger,
): void {
  if (!existsSync(cacheRoot) || orgMaxBytes <= 0) return;

  let total = totalOrgDepsCacheBytes(cacheRoot, orgId);
  if (total <= orgMaxBytes) return;

  const entries = listFingerprintDirsForOrg(cacheRoot, orgId).map((dir) => ({
    dir,
    mtime: statSync(dir).mtimeMs,
    size: dirSizeBytes(dir),
  }));
  entries.sort((a, b) => a.mtime - b.mtime);

  for (const e of entries) {
    if (total <= orgMaxBytes) break;
    try {
      rmSync(e.dir, { recursive: true, force: true });
      total -= e.size;
      logger.log(`[build-cache] cache_evict_org freed ~${e.size} bytes (${e.dir})`);
    } catch (err) {
      logger.warn(`[build-cache] cache_evict_org failed ${e.dir}: ${err}`);
    }
  }
}

/**
 * 写入缓存后的统一淘汰：**先 TTL**，再 **单组织 LRU**，最后 **全局 LRU**（与 v0.5 需求规格一致）。
 */
export function runDepsCacheEvictionPipeline(
  cacheRoot: string,
  orgId: string,
  globalMaxBytes: number,
  logger: Logger,
): void {
  const ttlDays = resolveCacheMaxAgeDays();
  if (ttlDays != null) {
    try {
      evictDepsCacheTtl(cacheRoot, ttlDays, logger);
    } catch (e) {
      logger.warn(`[build-cache] TTL 淘汰异常: ${e}`);
    }
  }
  const orgMax = resolveCacheOrgMaxBytes();
  if (orgMax != null) {
    try {
      evictOrgDepsCacheLru(cacheRoot, orgId, orgMax, logger);
    } catch (e) {
      logger.warn(`[build-cache] 组织配额淘汰异常: ${e}`);
    }
  }
  try {
    evictDepsCacheLru(cacheRoot, globalMaxBytes, logger);
  } catch (e) {
    logger.warn(`[build-cache] 依赖缓存 LRU 淘汰异常: ${e}`);
  }
}
