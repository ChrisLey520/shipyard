import { Controller, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import type { User } from '@prisma/client';
import { Queue } from 'bullmq';

@ApiTags('部署')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/projects/:projectSlug')
export class DeployController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** 一键回滚到指定历史部署的产物 */
  @Post('deployments/:deploymentId/rollback')
  @Roles(OrgRole.DEVELOPER)
  @HttpCode(HttpStatus.OK)
  async rollback(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('deploymentId') sourceDeploymentId: string,
    @CurrentUser() user: User,
  ) {
    const project = await this.prisma.project.findFirstOrThrow({
      where: { organizationId: orgId, slug: projectSlug },
    });

    const sourceDeployment = await this.prisma.deployment.findFirstOrThrow({
      where: { id: sourceDeploymentId, projectId: project.id },
      include: { artifact: true, environment: true },
    });

    if (!sourceDeployment.artifact) {
      return { error: '该部署的产物已被清理，无法回滚' };
    }
    if (!sourceDeployment.environmentId) {
      return { error: 'PR Preview 部署无法回滚' };
    }

    // 检查环境保护
    const env = await this.prisma.environment.findUniqueOrThrow({
      where: { id: sourceDeployment.environmentId },
    });

    const rollbackDeployment = await this.prisma.deployment.create({
      data: {
        projectId: project.id,
        environmentId: sourceDeployment.environmentId,
        status: env.protected ? 'pending_approval' : 'queued',
        trigger: 'rollback',
        triggeredByUserId: user.id,
        artifactId: sourceDeployment.artifactId,
        configSnapshot: (sourceDeployment.configSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        branch: sourceDeployment.branch,
        commitSha: sourceDeployment.commitSha,
        commitMessage: `[Rollback] ${sourceDeployment.commitMessage ?? ''}`,
        commitAuthor: user.name,
      },
    });

    if (env.protected) {
      await this.prisma.approvalRequest.create({
        data: {
          deploymentId: rollbackDeployment.id,
          requestedByUserId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } else {
      // 直接入 DeployQueue（跳过构建）
      const queue = new Queue(`deploy:${orgId}`, { connection: this.redis.getClient() });
      await queue.add('deploy', {
        deploymentId: rollbackDeployment.id,
        projectId: project.id,
        environmentId: sourceDeployment.environmentId,
        orgId,
      }, { jobId: `deploy-${rollbackDeployment.id}` });
    }

    return rollbackDeployment;
  }
}
