import { Module } from '@nestjs/common';
import { BuildWorkerService } from './build-worker.service';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { GitModule } from '../git/git.module';

@Module({
  imports: [CryptoModule, GitModule],
  providers: [BuildWorkerService],
})
export class BuildProcessorModule {}
