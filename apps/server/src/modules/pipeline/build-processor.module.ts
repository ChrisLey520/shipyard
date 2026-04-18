import { Module } from '@nestjs/common';
import { BuildWorkerService } from './build-worker.service';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { GitModule } from '../git/git.module';
import { NotificationsEnqueueModule } from '../notifications/notifications-enqueue.module';
import { ArtifactsModule } from '../artifacts/artifacts.module';

@Module({
  imports: [CryptoModule, GitModule, NotificationsEnqueueModule, ArtifactsModule],
  providers: [BuildWorkerService],
})
export class BuildProcessorModule {}
