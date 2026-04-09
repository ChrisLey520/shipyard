import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

// monorepo：强制从仓库根目录加载环境变量（pnpm filter 运行时 cwd 可能在 apps/server）
loadDotenv({ path: resolve(__dirname, '../../../.env') });
loadDotenv({ path: resolve(__dirname, '../../../.env.local') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  console.log('Worker process started');

  process.on('SIGTERM', async () => {
    console.log('Worker shutting down...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
