import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ShipyardErrorResponse } from '@shipyard/shared';

export type { ShipyardErrorResponse };

export class ShipyardHttpException extends HttpException {
  constructor(status: HttpStatus, response: ShipyardErrorResponse) {
    super(response, status);
  }
}

