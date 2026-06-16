import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  findPackageRootForOutputDir,
  toPosixRelativeSubpath,
  usesPm2RuntimeFramework,
} from './node-runtime-bundle';

describe('node-runtime-bundle helpers', () => {
  it('treats non-static frameworks as PM2-managed runtimes', () => {
    expect(usesPm2RuntimeFramework('static')).toBe(false);
    expect(usesPm2RuntimeFramework('ssr')).toBe(true);
    expect(usesPm2RuntimeFramework('nodejs')).toBe(true);
  });

  it('finds the nearest package root above outputDir', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'shipyard-node-bundle-'));
    try {
      const appRoot = path.join(tmp, 'apps', 'server');
      const distDir = path.join(appRoot, 'dist');
      mkdirSync(distDir, { recursive: true });
      writeFileSync(path.join(tmp, 'package.json'), '{}');
      writeFileSync(path.join(appRoot, 'package.json'), '{}');

      expect(findPackageRootForOutputDir(tmp, distDir)).toBe(appRoot);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns null when outputDir escapes repo root', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'shipyard-node-bundle-'));
    try {
      expect(findPackageRootForOutputDir(tmp, path.join(os.tmpdir(), 'outside-dist'))).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('normalizes relative paths to posix form', () => {
    const root = path.join('/tmp', 'repo');
    const target = path.join(root, 'apps', 'server');
    expect(toPosixRelativeSubpath(root, target)).toBe('apps/server');
    expect(toPosixRelativeSubpath(root, root)).toBe('.');
  });
});
