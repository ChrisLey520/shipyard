import { Module } from '@nestjs/common';
import { DeployWorkerService } from './deploy-worker.service';
import { DeployService } from './deploy.service';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { GitModule } from '../git/git.module';

@Module({
  imports: [CryptoModule, GitModule],
  providers: [DeployWorkerService, DeployService],
})
export class DeployProcessorModule {}
