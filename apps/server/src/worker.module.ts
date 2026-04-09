import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { BuildProcessorModule } from './modules/pipeline/build-processor.module';
import { DeployProcessorModule } from './modules/deploy/deploy-processor.module';
import { NotifyProcessorModule } from './modules/notifications/notify-processor.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BuildProcessorModule,
    DeployProcessorModule,
    NotifyProcessorModule,
  ],
})
export class WorkerModule {}
