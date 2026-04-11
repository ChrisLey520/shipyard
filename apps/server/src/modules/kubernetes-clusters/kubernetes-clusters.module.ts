import { Module } from '@nestjs/common';
import { KubernetesClustersController } from './kubernetes-clusters.controller';
import { KubernetesClustersApplicationService } from './application/kubernetes-clusters.application.service';

@Module({
  controllers: [KubernetesClustersController],
  providers: [KubernetesClustersApplicationService],
  exports: [KubernetesClustersApplicationService],
})
export class KubernetesClustersModule {}
