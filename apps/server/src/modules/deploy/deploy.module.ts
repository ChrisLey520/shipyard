import { Module } from '@nestjs/common';
import { DeployService } from './deploy.service';
import { DeployController } from './deploy.controller';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { GitModule } from '../git/git.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PreviewPortPoolService } from './application/preview-port-pool.service';
import { NotificationsEnqueueModule } from '../notifications/notifications-enqueue.module';
import { KubernetesClustersModule } from '../kubernetes-clusters/kubernetes-clusters.module';

@Module({
  imports: [CryptoModule, GitModule, RedisModule, NotificationsEnqueueModule, KubernetesClustersModule],
  providers: [DeployService, PreviewPortPoolService],
  controllers: [DeployController],
  exports: [DeployService, PreviewPortPoolService],
})
export class DeployModule {}
