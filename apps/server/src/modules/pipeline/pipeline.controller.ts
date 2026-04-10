import {
  Controller, Get, Post, Body, Param, UseGuards, NotFoundException, BadRequestException,
} from '@nestjs/common';
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

    const r = await this.pipeline.enqueueBuild(
      orgId,
      project.id,
      env.id,
      'manual',
      body.branch ?? env.triggerBranch,
      '手动触发',
      user.name,
      user.id,
    );
    return r.deployment;
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

  /** 基于失败记录重新入队构建（新 deployment） */
  @Post('deployments/:deploymentId/retry')
  @Roles(OrgRole.DEVELOPER)
  async retryDeployment(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('deploymentId') deploymentId: string,
    @CurrentUser() user: User,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: projectSlug },
    });
    if (!project) throw new NotFoundException('项目不存在');

    const dep = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId: project.id },
    });
    if (!dep) throw new NotFoundException('部署不存在');
    if (dep.status !== 'failed') {
      throw new BadRequestException('仅失败状态的部署可重试');
    }
    if (!dep.environmentId) {
      throw new BadRequestException('预览类部署请从项目内重新触发构建');
    }

    const r = await this.pipeline.enqueueBuild(
      orgId,
      project.id,
      dep.environmentId,
      dep.commitSha?.trim() || 'manual',
      dep.branch?.trim() || 'main',
      `[Retry] ${dep.commitMessage?.trim() || '部署'}`,
      user.name,
      user.id,
    );
    return r.deployment;
  }
}
