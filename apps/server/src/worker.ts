import { loadRootEnvFiles } from './load-root-env';

loadRootEnvFiles();

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
