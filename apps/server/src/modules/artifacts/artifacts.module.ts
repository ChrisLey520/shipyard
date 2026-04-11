import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ArtifactRetentionApplicationService } from './application/artifact-retention.application.service';

@Module({
  imports: [PrismaModule],
  providers: [ArtifactRetentionApplicationService],
  exports: [ArtifactRetentionApplicationService],
})
export class ArtifactsModule {}
