import { Module } from '@nestjs/common';
import { DeployWorkerService } from './deploy-worker.service';
import { DeployService } from './deploy.service';
import { CryptoModule } from '../../common/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  providers: [DeployWorkerService, DeployService],
})
export class DeployProcessorModule {}
