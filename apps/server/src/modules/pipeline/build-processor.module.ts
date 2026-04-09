import { Module } from '@nestjs/common';
import { BuildWorkerService } from './build-worker.service';
import { CryptoModule } from '../../common/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  providers: [BuildWorkerService],
})
export class BuildProcessorModule {}
