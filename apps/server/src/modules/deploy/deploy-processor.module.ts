import { Module } from '@nestjs/common';
import { DeployWorkerService } from './deploy-worker.service';
import { DeployService } from './deploy.service';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { GitModule } from '../git/git.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PreviewPortPoolService } from './application/preview-port-pool.service';
import { NotificationsEnqueueModule } from '../notifications/notifications-enqueue.module';

@Module({
  imports: [CryptoModule, GitModule, RedisModule, NotificationsEnqueueModule],
  providers: [DeployWorkerService, DeployService, PreviewPortPoolService],
})
export class DeployProcessorModule {}
