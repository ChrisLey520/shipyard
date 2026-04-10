import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isErrorCode } from '@shipyard/shared';
import { normalizeLocale, tError } from '../i18n/i18n';

@Catch(HttpException)
export class I18nHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { locale?: string | null } }>();

    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception.getResponse();

    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const payload = raw as Record<string, unknown>;
      const code = payload['code'];

      if (isErrorCode(code)) {
        const locale = normalizeLocale(request.user?.locale);
        const message = tError(code, locale);
        response.status(status).json({ ...payload, message, statusCode: status });
        return;
      }
    }

    // Default Nest behavior (but normalize shape with statusCode)
    const fallback =
      typeof raw === 'string'
        ? { message: raw }
        : raw && typeof raw === 'object'
          ? raw
          : { message: exception.message };

    response.status(status).json({ statusCode: status, ...(fallback as object) });
  }
}

