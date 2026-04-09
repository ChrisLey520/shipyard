import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';

@ApiTags('项目')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Roles(OrgRole.VIEWER)
  list(@OrgId() orgId: string) {
    return this.projects.listProjects(orgId);
  }

  @Post()
  @Roles(OrgRole.DEVELOPER)
  create(
    @OrgId() orgId: string,
    @Body() body: {
      name: string;
      slug: string;
      frameworkType: string;
      repoFullName: string;
      gitProvider: string;
      accessToken: string;
      gitUsername?: string;
      buildCommand?: string;
      outputDir?: string;
    },
  ) {
    return this.projects.createProject(orgId, body);
  }

  @Get(':projectSlug')
  @Roles(OrgRole.VIEWER)
  get(@OrgId() orgId: string, @Param('projectSlug') projectSlug: string) {
    return this.projects.getProject(orgId, projectSlug);
  }

  @Patch(':projectSlug')
  @Roles(OrgRole.DEVELOPER)
  update(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Body() body: { name?: string; frameworkType?: string },
  ) {
    return this.projects.updateProject(orgId, projectSlug, body);
  }

  @Delete(':projectSlug')
  @Roles(OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@OrgId() orgId: string, @Param('projectSlug') projectSlug: string) {
    return this.projects.deleteProject(orgId, projectSlug);
  }

  @Patch(':projectSlug/pipeline-config')
  @Roles(OrgRole.DEVELOPER)
  updatePipelineConfig(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Body() body: {
      installCommand?: string;
      buildCommand?: string;
      lintCommand?: string;
      testCommand?: string;
      outputDir?: string;
      nodeVersion?: string;
      cacheEnabled?: boolean;
      timeoutSeconds?: number;
      ssrEntryPoint?: string;
    },
  ) {
    return this.projects.updatePipelineConfig(orgId, projectSlug, body);
  }

  @Get(':projectSlug/deployments')
  @Roles(OrgRole.VIEWER)
  getDeployments(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Query('environmentId') environmentId?: string,
  ) {
    return this.projects.getDeployments(orgId, projectSlug, environmentId);
  }
}
