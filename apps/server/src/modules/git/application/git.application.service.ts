import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';

type GithubRepoItem = {
  id: number;
  full_name: string;
  private: boolean;
  updated_at: string;
};

@Injectable()
export class GitApplicationService {
  private readonly logger = new Logger(GitApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async listGithubReposByPat(pat: string): Promise<Array<{ fullName: string; private: boolean }>> {
    // 只取前 100 个（后续可做 pagination）
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitHub list repos failed HTTP ${res.status}: ${text}`);
      throw new Error('GitHub 仓库列表获取失败（请检查 PAT 权限）');
    }

    const json = (await res.json()) as GithubRepoItem[];
    return json
      .filter((r) => Boolean(r.full_name))
      .map((r) => ({ fullName: r.full_name, private: Boolean(r.private) }));
  }

  async listGithubBranchesByPat(pat: string, repoFullName: string): Promise<string[]> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) throw new Error('repoFullName 格式错误，应为 owner/repo');

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitHub list branches failed HTTP ${res.status}: ${text}`);
      throw new Error('GitHub 分支列表获取失败（请检查仓库权限）');
    }

    const json = (await res.json()) as Array<{ name?: string }>;
    return json.map((b) => b.name).filter((n): n is string => Boolean(n));
  }

  async listGithubBranchesForProject(opts: { orgId: string; projectSlug: string }): Promise<string[]> {
    const project = await this.prisma.project.findFirst({
      where: { organizationId: opts.orgId, slug: opts.projectSlug },
      select: { id: true, repoFullName: true },
    });
    if (!project) throw new Error('项目不存在');

    const gitConn = await this.prisma.gitConnection.findUnique({
      where: { projectId: project.id },
      select: { gitProvider: true, accessToken: true },
    });
    if (!gitConn) throw new Error('未配置 Git 连接');
    if (gitConn.gitProvider !== 'github') throw new Error('当前仅支持 GitHub 分支下拉');

    const pat = this.crypto.decrypt(gitConn.accessToken);
    return this.listGithubBranchesByPat(pat, project.repoFullName);
  }

  async listGitlabReposByPat(pat: string, baseUrl = 'https://gitlab.com'): Promise<Array<{ fullName: string; private: boolean }>> {
    const apiBase = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${apiBase}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at`, {
      headers: {
        'PRIVATE-TOKEN': pat,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitLab list repos failed HTTP ${res.status}: ${text}`);
      throw new Error('GitLab 仓库列表获取失败（请检查 PAT 权限 / Base URL）');
    }
    const json = (await res.json()) as Array<{ path_with_namespace?: string; visibility?: string }>;
    return json
      .map((r) => r.path_with_namespace)
      .filter((n): n is string => Boolean(n))
      .map((fullName) => ({ fullName, private: true }));
  }

  async listGitlabBranchesByPat(pat: string, repoFullName: string, baseUrl = 'https://gitlab.com'): Promise<string[]> {
    const apiBase = baseUrl.replace(/\/$/, '');
    const projectPath = encodeURIComponent(repoFullName);
    const res = await fetch(`${apiBase}/api/v4/projects/${projectPath}/repository/branches?per_page=100`, {
      headers: {
        'PRIVATE-TOKEN': pat,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitLab list branches failed HTTP ${res.status}: ${text}`);
      throw new Error('GitLab 分支列表获取失败（请检查仓库权限 / Base URL）');
    }
    const json = (await res.json()) as Array<{ name?: string }>;
    return json.map((b) => b.name).filter((n): n is string => Boolean(n));
  }

  async listGiteeReposByPat(pat: string): Promise<Array<{ fullName: string; private: boolean }>> {
    const url = `https://gitee.com/api/v5/user/repos?access_token=${encodeURIComponent(pat)}&per_page=100&sort=updated`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitee list repos failed HTTP ${res.status}: ${text}`);
      throw new Error('Gitee 仓库列表获取失败（请检查 PAT 权限）');
    }
    const json = (await res.json()) as Array<{ full_name?: string; private?: boolean }>;
    return json
      .map((r) => ({ fullName: r.full_name, private: Boolean(r.private) }))
      .filter((r): r is { fullName: string; private: boolean } => Boolean(r.fullName));
  }

  async listGiteeBranchesByPat(pat: string, repoFullName: string): Promise<string[]> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) throw new Error('repoFullName 格式错误，应为 owner/repo');
    const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/branches?access_token=${encodeURIComponent(pat)}&per_page=100`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitee list branches failed HTTP ${res.status}: ${text}`);
      throw new Error('Gitee 分支列表获取失败（请检查仓库权限）');
    }
    const json = (await res.json()) as Array<{ name?: string }>;
    return json.map((b) => b.name).filter((n): n is string => Boolean(n));
  }

  async listGiteaReposByPat(pat: string, baseUrl: string): Promise<Array<{ fullName: string; private: boolean }>> {
    const apiBase = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${apiBase}/api/v1/user/repos?limit=100`, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitea list repos failed HTTP ${res.status}: ${text}`);
      throw new Error('Gitea 仓库列表获取失败（请检查 PAT 权限 / Base URL）');
    }
    const json = (await res.json()) as Array<{ full_name?: string; private?: boolean }>;
    return json
      .map((r) => ({ fullName: r.full_name, private: Boolean(r.private) }))
      .filter((r): r is { fullName: string; private: boolean } => Boolean(r.fullName));
  }

  async listGiteaBranchesByPat(pat: string, repoFullName: string, baseUrl: string): Promise<string[]> {
    const apiBase = baseUrl.replace(/\/$/, '');
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) throw new Error('repoFullName 格式错误，应为 owner/repo');
    const res = await fetch(`${apiBase}/api/v1/repos/${owner}/${repo}/branches?limit=100`, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitea list branches failed HTTP ${res.status}: ${text}`);
      throw new Error('Gitea 分支列表获取失败（请检查仓库权限 / Base URL）');
    }
    const json = (await res.json()) as Array<{ name?: string }>;
    return json.map((b) => b.name).filter((n): n is string => Boolean(n));
  }

  async listProjectBranches(opts: { orgId: string; projectSlug: string }): Promise<string[]> {
    const project = await this.prisma.project.findFirst({
      where: { organizationId: opts.orgId, slug: opts.projectSlug },
      select: { id: true, repoFullName: true },
    });
    if (!project) throw new Error('项目不存在');

    const gitConn = await this.prisma.gitConnection.findUnique({
      where: { projectId: project.id },
      select: { gitProvider: true, accessToken: true, baseUrl: true },
    });
    if (!gitConn) throw new Error('未配置 Git 连接');

    const pat = this.crypto.decrypt(gitConn.accessToken);
    switch (gitConn.gitProvider) {
      case 'github':
        return this.listGithubBranchesByPat(pat, project.repoFullName);
      case 'gitlab':
        return this.listGitlabBranchesByPat(pat, project.repoFullName, gitConn.baseUrl ?? undefined);
      case 'gitee':
        return this.listGiteeBranchesByPat(pat, project.repoFullName);
      case 'gitea':
        if (!gitConn.baseUrl) return [];
        return this.listGiteaBranchesByPat(pat, project.repoFullName, gitConn.baseUrl);
      default:
        return [];
    }
  }
}

