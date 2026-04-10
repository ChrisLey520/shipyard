/**
 * 从 monorepo 根目录加载 .env / .env.local，再执行 Prisma CLI（migrate / studio 等需要 DATABASE_URL）
 */
const path = require('path');
const { spawnSync } = require('child_process');

const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '../..');

require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const prismaCli = require.resolve('prisma/build/index.js');
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [prismaCli, ...args], {
  stdio: 'inherit',
  cwd: serverRoot,
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
