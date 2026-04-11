import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDepsCacheEvictionPipeline } from './build-deps-cache';

const mockLogger = {
  log: vi.fn(),
  warn: vi.fn(),
};

describe('runDepsCacheEvictionPipeline（文件锁 + 淘汰）', () => {
  let root: string;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    if (root) {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        /* skip */
      }
    }
  });

  it('空缓存根可完成（无指纹目录）', async () => {
    root = mkdtempSync(path.join(tmpdir(), 'shipyard-cache-'));
    await expect(
      runDepsCacheEvictionPipeline(root, 'org1', 1024, mockLogger as never),
    ).resolves.toBeUndefined();
  });

  it('并发两次调用同一根目录均可完成', async () => {
    vi.stubEnv('SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS', '3650');
    root = mkdtempSync(path.join(tmpdir(), 'shipyard-cache-'));
    const org = 'o1';
    const pm = 'pnpm';
    const fp = 'a'.repeat(48);
    const fpDir = path.join(root, org, pm, fp);
    mkdirSync(path.join(fpDir, 'node_modules'), { recursive: true });
    writeFileSync(path.join(fpDir, 'node_modules', '.keep'), '');

    await Promise.all([
      runDepsCacheEvictionPipeline(root, org, 1, mockLogger as never),
      runDepsCacheEvictionPipeline(root, org, 1, mockLogger as never),
    ]);
  });
});
