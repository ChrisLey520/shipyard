import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const monitoringPort = process.env['MONITORING_PORT'] ?? '3031';
const baseURL = `http://127.0.0.1:${monitoringPort}`;

const monitoringDatabaseUrl =
  process.env['MONITORING_DATABASE_URL'] ??
  'postgresql://postgres:postgres@127.0.0.1:5432/monitoring_ci';

export default defineConfig({
  testDir: './tests-monitoring',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: [
      'pnpm --filter @shipyard/monitoring-server exec prisma generate',
      'pnpm --filter @shipyard/monitoring-server exec prisma db push --accept-data-loss',
      'pnpm --filter @shipyard/monitoring-server db:seed',
      'pnpm --filter @shipyard/monitoring-server dev',
    ].join(' && '),
    cwd: repoRoot,
    url: `${baseURL}/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env['CI'],
    env: {
      ...process.env,
      MONITORING_PORT: monitoringPort,
      MONITORING_DATABASE_URL: monitoringDatabaseUrl,
      MONITORING_ADMIN_TOKEN: process.env['MONITORING_ADMIN_TOKEN'] ?? 'e2e-admin-token',
      MONITORING_SEED_PROJECT_KEY: process.env['MONITORING_SEED_PROJECT_KEY'] ?? 'e2e_project',
      MONITORING_SEED_INGEST_TOKEN: process.env['MONITORING_SEED_INGEST_TOKEN'] ?? 'e2e-ingest-token',
    },
  },
});
