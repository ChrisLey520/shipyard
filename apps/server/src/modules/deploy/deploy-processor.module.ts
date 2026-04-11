import { Module } from '@nestjs/common';
import { DeployWorkerService } from './deploy-worker.service';
import { DeployService } from './deploy.service';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { GitModule } from '../git/git.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PreviewPortPoolService } from './application/preview-port-pool.service';

@Module({
  imports: [CryptoModule, GitModule, RedisModule],
  providers: [DeployWorkerService, DeployService, PreviewPortPoolService],
})
export class DeployProcessorModule {}
