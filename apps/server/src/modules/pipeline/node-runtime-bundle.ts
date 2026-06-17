import { existsSync } from 'fs';
import * as path from 'path';

export function usesPm2RuntimeFramework(frameworkType: string): boolean {
  return frameworkType !== 'static';
}

export function isRelativeSubdir(input: string): boolean {
  const normalized = input.trim().replace(/\\/g, '/');
  if (!normalized || normalized === '.') return true;
  if (normalized.startsWith('/') || normalized.startsWith('../') || normalized.includes('/../')) {
    return false;
  }
  return normalized !== '..';
}

export function findPackageRootForOutputDir(repoRoot: string, outputDir: string): string | null {
  const root = path.resolve(repoRoot);
  let current = path.resolve(outputDir);
  while (true) {
    if (!isPathInsideRoot(root, current)) return null;
    if (existsSync(path.join(current, 'package.json'))) return current;
    if (current === root) break;
    current = path.dirname(current);
  }
  return existsSync(path.join(root, 'package.json')) ? root : null;
}

export function toPosixRelativeSubpath(root: string, target: string): string | null {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.length > 0 ? rel.split(path.sep).join('/') : '.';
}

export function hasPnpmWorkspace(repoRoot: string): boolean {
  return existsSync(path.join(path.resolve(repoRoot), 'pnpm-workspace.yaml'));
}

function isPathInsideRoot(root: string, target: string): boolean {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  if (normalizedRoot === normalizedTarget) return true;
  return normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
}
