import { loadRootEnvFiles } from './load-root-env';

loadRootEnvFiles();

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

const workerLogger = new Logger('Worker');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  workerLogger.log('Worker process started');

  process.on('SIGTERM', async () => {
    workerLogger.log('Worker shutting down...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err: unknown) => {
  workerLogger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
