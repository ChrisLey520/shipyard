import './env-bootstrap';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));

  const corsOrigin = process.env['MONITORING_CORS_ORIGIN'];
  if (corsOrigin === '*' || corsOrigin === undefined) {
    app.enableCors({ origin: true, credentials: false });
  } else {
    const list = corsOrigin.split(',').map((s) => s.trim());
    app.enableCors({
      origin: list,
      credentials: false,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = parseInt(process.env['MONITORING_PORT'] ?? '3030', 10);
  await app.listen(port);
  logger.log(`Monitoring ingest at http://localhost:${port}/v1/ingest/batch`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
