import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import { KubernetesClustersApplicationService } from './application/kubernetes-clusters.application.service';

@ApiTags('Kubernetes 集群')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/kubernetes-clusters')
export class KubernetesClustersController {
  constructor(private readonly clusters: KubernetesClustersApplicationService) {}

  @Get()
  @Roles(OrgRole.VIEWER)
  list(@OrgId() orgId: string) {
    return this.clusters.list(orgId);
  }

  @Post()
  @Roles(OrgRole.ADMIN)
  create(@OrgId() orgId: string, @Body() body: { name: string; kubeconfig: string }) {
    return this.clusters.create(orgId, body);
  }

  @Delete(':clusterId')
  @Roles(OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@OrgId() orgId: string, @Param('clusterId') clusterId: string) {
    return this.clusters.delete(orgId, clusterId);
  }
}
