import { config } from 'dotenv';
import { resolve } from 'path';

function loadEnv(): void {
  const root = resolve(process.cwd(), '../..');
  config({ path: resolve(root, '.env') });
  config({ path: resolve(root, '.env.local') });
  config({ path: resolve(process.cwd(), '.env') });
  config();
}

loadEnv();

const abs = resolve(process.cwd(), 'prisma/monitoring.db');
if (!process.env['MONITORING_DATABASE_URL']?.trim()) {
  process.env['MONITORING_DATABASE_URL'] = `file:${abs}`;
}
