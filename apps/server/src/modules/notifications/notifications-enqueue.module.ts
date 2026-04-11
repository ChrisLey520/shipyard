import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationEnqueueApplicationService } from './application/notification-enqueue.application.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [NotificationEnqueueApplicationService],
  exports: [NotificationEnqueueApplicationService],
})
export class NotificationsEnqueueModule {}
