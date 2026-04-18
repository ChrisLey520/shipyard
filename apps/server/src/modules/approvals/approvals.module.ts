import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { NotificationsEnqueueModule } from '../notifications/notifications-enqueue.module';

@Module({
  imports: [NotificationsEnqueueModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}

