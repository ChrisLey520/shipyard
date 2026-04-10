import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { GitService } from './git.service';

@ApiTags('Git')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class GitController {
  constructor(private readonly git: GitService) {}

  /**
   * 使用 PAT 拉取可访问仓库列表（不落库，仅用于 UI 下拉框）
   */
  @Post('git/github/repos')
  async listGithubRepos(@Body() body: { pat: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    return this.git.listGithubReposByPat(body.pat);
  }

  /**
   * 使用 PAT 拉取某仓库分支列表（不落库，仅用于 UI 下拉框）
   */
  @Post('git/github/branches')
  async listGithubBranches(@Body() body: { pat: string; repoFullName: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    if (!body?.repoFullName) throw new Error('repoFullName 不能为空');
    return this.git.listGithubBranchesByPat(body.pat, body.repoFullName);
  }

  @Post('git/gitlab/repos')
  async listGitlabRepos(@Body() body: { pat: string; baseUrl?: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    return this.git.listGitlabReposByPat(body.pat, body.baseUrl);
  }

  @Post('git/gitlab/branches')
  async listGitlabBranches(@Body() body: { pat: string; repoFullName: string; baseUrl?: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    if (!body?.repoFullName) throw new Error('repoFullName 不能为空');
    return this.git.listGitlabBranchesByPat(body.pat, body.repoFullName, body.baseUrl);
  }

  @Post('git/gitee/repos')
  async listGiteeRepos(@Body() body: { pat: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    return this.git.listGiteeReposByPat(body.pat);
  }

  @Post('git/gitee/branches')
  async listGiteeBranches(@Body() body: { pat: string; repoFullName: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    if (!body?.repoFullName) throw new Error('repoFullName 不能为空');
    return this.git.listGiteeBranchesByPat(body.pat, body.repoFullName);
  }

  @Post('git/gitea/repos')
  async listGiteaRepos(@Body() body: { pat: string; baseUrl: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    if (!body?.baseUrl) throw new Error('Base URL 不能为空');
    return this.git.listGiteaReposByPat(body.pat, body.baseUrl);
  }

  @Post('git/gitea/branches')
  async listGiteaBranches(@Body() body: { pat: string; repoFullName: string; baseUrl: string }) {
    if (!body?.pat) throw new Error('PAT 不能为空');
    if (!body?.repoFullName) throw new Error('repoFullName 不能为空');
    if (!body?.baseUrl) throw new Error('Base URL 不能为空');
    return this.git.listGiteaBranchesByPat(body.pat, body.repoFullName, body.baseUrl);
  }

  /**
   * 使用已保存的 GitConnection token 拉取分支列表（用于环境的分支下拉）
   */
  @Get('orgs/:orgSlug/projects/:projectSlug/git/github/branches')
  async listProjectGithubBranches(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.git.listGithubBranchesForProject({ orgId, projectSlug });
  }

  /**
   * 统一分支下拉：根据项目 gitProvider 自动选择（GitHub/GitLab/Gitee；Gitea 暂不支持自动下拉）
   */
  @Get('orgs/:orgSlug/projects/:projectSlug/git/branches')
  async listProjectBranches(@OrgId() orgId: string, @Param('projectSlug') projectSlug: string) {
    return this.git.listProjectBranches({ orgId, projectSlug });
  }
}

