import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@shipyard/shared';

export type ShipyardErrorResponse = {
  code: ErrorCode;
  message?: string;
  params?: Record<string, unknown>;
};

export class ShipyardHttpException extends HttpException {
  constructor(status: HttpStatus, response: ShipyardErrorResponse) {
    super(response, status);
  }
}

