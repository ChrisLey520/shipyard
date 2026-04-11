import { loadRootEnvFiles } from './load-root-env';

// monorepo：从仓库根目录加载 .env（向上查找，避免 __dirname/ cwd 不一致导致读不到变量）
loadRootEnvFiles();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  PrismaKnownRequestExceptionFilter,
  PrismaValidationExceptionFilter,
} from './common/filters/prisma-exception.filter';
import { I18nHttpExceptionFilter } from './common/filters/i18n-exception.filter';
import helmet from 'helmet';
import express from 'express';
import { join } from 'path';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(helmet());
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalFilters(
    new I18nHttpExceptionFilter(),
    new PrismaKnownRequestExceptionFilter(),
    new PrismaValidationExceptionFilter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  try {
    const config = new DocumentBuilder()
      .setTitle('Shipyard API')
      .setDescription('前端 CI/CD 平台 API 文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  } catch (err) {
    // 避免 Swagger 元数据问题导致服务无法启动
    bootstrapLogger.warn(`[swagger] disabled due to error: ${err}`);
  }

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  bootstrapLogger.log(`Server running on http://localhost:${port}`);
  bootstrapLogger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err: unknown) => {
  bootstrapLogger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
