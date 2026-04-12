import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '../src/generated/monitoring-prisma';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });
if (!process.env['MONITORING_DATABASE_URL']?.trim()) {
  process.env['MONITORING_DATABASE_URL'] =
    'postgresql://shipyard:shipyard_pass@127.0.0.1:5432/monitoring';
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const key = process.env['MONITORING_SEED_PROJECT_KEY'] ?? 'default';
  const token = process.env['MONITORING_SEED_INGEST_TOKEN'] ?? 'dev-ingest-token-change-me';
  await prisma.monitoringProject.upsert({
    where: { projectKey: key },
    create: { projectKey: key, ingestToken: token },
    update: { ingestToken: token },
  });
  console.log(`Seeded projectKey=${key}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
