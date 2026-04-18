import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsCrudApplicationService } from './application/notifications-crud.application.service';

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [NotificationsController],
  providers: [NotificationsCrudApplicationService],
})
export class NotificationsApiModule {}
