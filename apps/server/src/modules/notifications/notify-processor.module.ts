import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { NotifyWorkerService } from './notify-worker.service';

@Module({
  imports: [PrismaModule, RedisModule, CryptoModule],
  providers: [NotifyWorkerService],
})
export class NotifyProcessorModule {}
