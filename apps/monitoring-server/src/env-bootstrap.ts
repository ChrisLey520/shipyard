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

/** v2：使用独立库 `monitoring`，勿与 Shipyard 主库 `shipyard` 共用（避免 prisma db push 覆盖主 schema） */
if (!process.env['MONITORING_DATABASE_URL']?.trim()) {
  process.env['MONITORING_DATABASE_URL'] =
    'postgresql://shipyard:shipyard_pass@127.0.0.1:5432/monitoring';
}
