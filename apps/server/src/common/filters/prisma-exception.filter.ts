import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * 将 Prisma 典型错误转为可读提示（便于排查 migrate / generate 未执行）
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaKnownRequestExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaKnownRequestExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.warn(`${exception.code} ${exception.message}`);

    if (exception.code === 'P2022') {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          '数据库结构与当前代码不一致（例如缺少列）。请在仓库根目录执行：pnpm db:migrate:deploy，再执行：pnpm db:generate，并重启 API 服务。',
        code: exception.code,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception.message,
      code: exception.code,
    });
  }
}

@Catch(Prisma.PrismaClientValidationError)
export class PrismaValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaValidationExceptionFilter.name);

  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.warn(exception.message);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        'Prisma 查询与已生成的 Client 不匹配（常见于拉代码后未生成 Client）。请在仓库根目录执行：pnpm db:generate，并重启 API 服务。',
      code: 'PRISMA_VALIDATION',
    });
  }
}
