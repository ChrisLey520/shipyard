import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { User } from '@prisma/client';

@ApiTags('Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/projects/:projectSlug')
export class PipelineController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('deploy')
  @Roles(OrgRole.DEVELOPER)
  async triggerDeploy(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @CurrentUser() user: User,
    @Body() body: { environmentId: string; branch?: string },
  ) {
    const project = await this.prisma.project.findFirstOrThrow({
      where: { organizationId: orgId, slug: projectSlug },
    });
    const env = await this.prisma.environment.findFirstOrThrow({
      where: { id: body.environmentId, projectId: project.id },
    });

    return this.pipeline.enqueueBuild(
      orgId,
      project.id,
      env.id,
      'manual',
      body.branch ?? env.triggerBranch,
      '手动触发',
      user.name,
      user.id,
    );
  }

  @Get('deployments/:deploymentId')
  @Roles(OrgRole.VIEWER)
  getDeployment(@Param('deploymentId') deploymentId: string) {
    return this.pipeline.getDeployment(deploymentId);
  }

  @Get('deployments/:deploymentId/logs')
  @Roles(OrgRole.VIEWER)
  getLogs(@Param('deploymentId') deploymentId: string) {
    return this.pipeline.getDeploymentLogs(deploymentId);
  }
}
