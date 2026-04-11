import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GitAccessTokenService } from '../git-access-token.service';

export type CommitStatusPhase = 'build' | 'deploy';

/** GitHub Commit Status API 的 state */
export type GithubCommitState = 'pending' | 'success' | 'failure' | 'error';

@Injectable()
export class GitCommitStatusApplicationService {
  private readonly logger = new Logger(GitCommitStatusApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: GitAccessTokenService,
  ) {}

  private appUrl(): string {
    return (process.env['APP_URL'] ?? 'http://localhost:5173').replace(/\/+$/, '');
  }

  async reportForDeployment(
    deploymentId: string,
    phase: CommitStatusPhase,
    state: GithubCommitState,
    description: string,
  ): Promise<void> {
    try {
      const dep = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: {
          project: {
            include: {
              organization: true,
              gitConnection: true,
            },
          },
        },
      });
      const sha = dep?.commitSha?.trim();
      const conn = dep?.project?.gitConnection;
      if (!sha || !conn || !dep.project) return;

      const token = await this.tokens.getAccessTokenForProject(dep.project.id);
      const { slug: orgSlug } = dep.project.organization;
      const { slug: projectSlug } = dep.project;
      const targetUrl = `${this.appUrl()}/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}`;
      const context = phase === 'build' ? 'shipyard/build' : 'shipyard/deploy';

      const repo = dep.project.repoFullName;
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) return;

      switch (conn.gitProvider) {
        case 'github':
          await this.postGithub(owner, repoName, token, sha, state, targetUrl, description, context);
          break;
        case 'gitlab': {
          const base = (conn.baseUrl ?? 'https://gitlab.com').replace(/\/+$/, '');
          await this.postGitlab(base, token, repo, sha, state, targetUrl, description, context);
          break;
        }
        case 'gitee':
          await this.postGitee(owner, repoName, token, sha, state, targetUrl, description, context);
          break;
        case 'gitea': {
          if (!conn.baseUrl?.trim()) return;
          const base = conn.baseUrl.replace(/\/+$/, '');
          await this.postGitea(base, owner, repoName, token, sha, state, targetUrl, description, context);
          break;
        }
        default:
          break;
      }
    } catch (e) {
      this.logger.warn(`Commit status 回写失败 deployment=${deploymentId}: ${e}`);
    }
  }

  private async postGithub(
    owner: string,
    repo: string,
    token: string,
    sha: string,
    state: GithubCommitState,
    targetUrl: string,
    description: string,
    context: string,
  ): Promise<void> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state,
        target_url: targetUrl,
        description: description.slice(0, 140),
        context,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.warn(`GitHub status HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
  }

  private gitlabState(state: GithubCommitState): string {
    if (state === 'success') return 'success';
    if (state === 'pending') return 'pending';
    return 'failed';
  }

  private async postGitlab(
    apiBase: string,
    token: string,
    pathWithNamespace: string,
    sha: string,
    state: GithubCommitState,
    targetUrl: string,
    description: string,
    context: string,
  ): Promise<void> {
    const enc = encodeURIComponent(pathWithNamespace);
    const res = await fetch(`${apiBase}/api/v4/projects/${enc}/statuses/${sha}`, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: this.gitlabState(state),
        name: context,
        target_url: targetUrl,
        description: description.slice(0, 140),
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.warn(`GitLab status HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
  }

  private giteeState(state: GithubCommitState): string {
    if (state === 'success') return 'success';
    if (state === 'pending') return 'pending';
    return 'error';
  }

  private async postGitee(
    owner: string,
    repo: string,
    token: string,
    sha: string,
    state: GithubCommitState,
    targetUrl: string,
    description: string,
    context: string,
  ): Promise<void> {
    const q = `access_token=${encodeURIComponent(token)}`;
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${owner}/${repo}/statuses/${sha}?${q}`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: this.giteeState(state),
          target_url: targetUrl,
          description: description.slice(0, 140),
          context,
        }),
      },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.warn(`Gitee status HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
  }

  private async postGitea(
    apiBase: string,
    owner: string,
    repo: string,
    token: string,
    sha: string,
    state: GithubCommitState,
    targetUrl: string,
    description: string,
    context: string,
  ): Promise<void> {
    const res = await fetch(`${apiBase}/api/v1/repos/${owner}/${repo}/statuses/${sha}`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state,
        target_url: targetUrl,
        description: description.slice(0, 140),
        context,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.warn(`Gitea status HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
  }
}
