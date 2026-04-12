import { Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/** Phase C：占位，避免 SDK 预研时 404 */
@Controller('v1/sourcemaps')
export class SourcemapsController {
  @Post()
  @HttpCode(501)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  notImplemented() {
    return { ok: false, message: 'Source map upload not implemented in MVP' };
  }
}
