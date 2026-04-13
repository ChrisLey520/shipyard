/**
 * tsc 只编译 .ts，不会把 Prisma 生成在 src/generated 下的引擎与静态资源带到 dist。
 * 运行 dist/main.js 时 require 解析到 dist/generated，需与 src/generated 保持一致。
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcGenerated = join(pkgRoot, 'src', 'generated');
const distDir = join(pkgRoot, 'dist');
const destGenerated = join(distDir, 'generated');

if (!existsSync(srcGenerated)) {
  console.error(`copy-generated-to-dist: missing ${srcGenerated}; run prisma generate first`);
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });
cpSync(srcGenerated, destGenerated, { recursive: true, force: true });
