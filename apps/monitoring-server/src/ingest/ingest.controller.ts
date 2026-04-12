import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IngestService } from './ingest.service';

@Controller('v1/ingest')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post('batch')
  @HttpCode(202)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async batch(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    return this.ingest.ingestBatch(authorization, body);
  }
}
