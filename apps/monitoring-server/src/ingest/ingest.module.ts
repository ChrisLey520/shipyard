import { Module } from '@nestjs/common';
import { HourlyBucketService } from './hourly-bucket.service';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

@Module({
  controllers: [IngestController],
  providers: [IngestService, HourlyBucketService],
})
export class IngestModule {}
