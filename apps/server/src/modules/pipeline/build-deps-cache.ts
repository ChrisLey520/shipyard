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
