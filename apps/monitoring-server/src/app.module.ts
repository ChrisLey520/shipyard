import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { IngestModule } from './ingest/ingest.module';
import { AdminModule } from './admin/admin.module';
import { SourcemapsModule } from './sourcemaps/sourcemaps.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 2000,
      },
    ]),
    PrismaModule,
    HealthModule,
    JobsModule,
    IngestModule,
    AdminModule,
    SourcemapsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
