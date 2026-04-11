import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/** 配置在 e2e/ 下，仓库根为上一级（webServer 的 pnpm 须在根目录执行） */
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @shipyard/server dev',
      cwd: repoRoot,
      url: 'http://127.0.0.1:3000/api/healthz',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm --filter @shipyard/web dev --host 127.0.0.1 --port 5173',
      cwd: repoRoot,
      url: 'http://127.0.0.1:5173/',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
