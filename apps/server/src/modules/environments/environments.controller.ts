import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EnvironmentsService } from './environments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('环境管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/projects/:projectSlug/environments')
export class EnvironmentsController {
  constructor(
    private readonly envs: EnvironmentsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getProjectId(orgId: string, projectSlug: string): Promise<string> {
    const project = await this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: projectSlug },
    });
    if (!project) throw new Error('项目不存在');
    return project.id;
  }

  @Get()
  @Roles(OrgRole.VIEWER)
  async list(@OrgId() orgId: string, @Param('projectSlug') projectSlug: string) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    return this.envs.listEnvironments(projectId);
  }

  /** 获取各环境最近一次成功部署的访问地址（用于概览展示） */
  @Get('access-urls')
  @Roles(OrgRole.VIEWER)
  async accessUrls(@OrgId() orgId: string, @Param('projectSlug') projectSlug: string) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    return this.envs.getEnvironmentAccessUrls(projectId);
  }

  @Post()
  @Roles(OrgRole.DEVELOPER)
  async create(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Body()
    body: {
      name: string;
      triggerBranch: string;
      serverId: string;
      deployPath: string;
      domain?: string;
      healthCheckUrl?: string;
      protected?: boolean;
      releaseConfig?: unknown;
      environmentTargets?: Array<{ serverId: string; sortOrder?: number; weight?: number }>;
    },
  ) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    return this.envs.createEnvironment(projectId, orgId, body);
  }

  @Patch(':envId')
  @Roles(OrgRole.DEVELOPER)
  async update(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('envId') envId: string,
    @Body()
    body: Partial<{
      name: string;
      triggerBranch: string;
      serverId: string;
      deployPath: string;
      domain: string;
      healthCheckUrl: string;
      protected: boolean;
      releaseConfig: unknown;
      environmentTargets: Array<{ serverId: string; sortOrder?: number; weight?: number }>;
    }>,
  ) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    return this.envs.updateEnvironment(envId, projectId, orgId, body);
  }

  @Delete(':envId')
  @Roles(OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('envId') envId: string,
  ) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    await this.envs.deleteEnvironment(envId, projectId);
  }

  @Get(':envId/variables')
  @Roles(OrgRole.DEVELOPER)
  async listVars(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('envId') envId: string,
  ) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    return this.envs.listEnvVars(envId, projectId);
  }

  @Post(':envId/variables')
  @Roles(OrgRole.DEVELOPER)
  async upsertVar(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('envId') envId: string,
    @Body() body: { key: string; value: string },
  ) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    return this.envs.upsertEnvVar(envId, projectId, body.key, body.value);
  }

  @Delete(':envId/variables/:varId')
  @Roles(OrgRole.DEVELOPER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVar(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('envId') envId: string,
    @Param('varId') varId: string,
  ) {
    const projectId = await this.getProjectId(orgId, projectSlug);
    await this.envs.deleteEnvVar(envId, projectId, varId);
  }
}
