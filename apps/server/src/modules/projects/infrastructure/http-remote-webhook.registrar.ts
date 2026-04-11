import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_GITLAB_BASE_URL, GitProvider, stripTrailingSlashes } from '@shipyard/shared';
import {
  githubRepoHookItemUrl,
  githubRepoHooksUrl,
  giteeRepoHookItemUrl,
  giteeRepoHooksListUrl,
  gitlabApiV4ProjectHookItemUrl,
  gitlabApiV4ProjectHooksUrl,
  giteaApiV1RepoHookItemUrl,
  giteaApiV1RepoHooksUrl,
} from '../../git/git-rest-api-urls';
import type { RemoteWebhookRegistrar } from '../application/ports/remote-webhook.registrar.port';

@Injectable()
export class HttpRemoteWebhookRegistrar implements RemoteWebhookRegistrar {
  private readonly logger = new Logger(HttpRemoteWebhookRegistrar.name);

  private getServerPublicUrl(): string | null {
    const url = process.env['SERVER_PUBLIC_URL']?.trim();
    if (!url) return null;
    return stripTrailingSlashes(url);
  }

  private webhookCallbackUrl(provider: string, projectId: string): string | null {
    const base = this.getServerPublicUrl();
    if (!base) return null;
    return `${base}/api/webhooks/${provider}?p=${encodeURIComponent(projectId)}`;
  }

  private githubAuthHeader(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    };
  }

  private async registerGithubWebhook(opts: {
    projectId: string;
    repoFullName: string;
    accessToken: string;
    webhookSecret: string;
  }): Promise<{ remoteWebhookId: string } | null> {
    const callbackUrl = this.webhookCallbackUrl(GitProvider.GITHUB, opts.projectId);
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 Webhook 自动注册');
      return null;
    }

    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) {
      this.logger.warn(`repoFullName 非法: ${opts.repoFullName}`);
      return null;
    }

    const pMark = `p=${opts.projectId}`;
    const listRes = await fetch(githubRepoHooksUrl(owner, repo), {
      headers: this.githubAuthHeader(opts.accessToken),
    });
    const desiredEvents = ['push', 'pull_request'];

    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{
        id?: number;
        config?: { url?: string };
        events?: string[];
      }>;
      const existing = hooks.find((h) => h.config?.url?.includes(pMark));
      if (existing?.id != null) {
        const ev = existing.events ?? [];
        const missing = desiredEvents.filter((e) => !ev.includes(e));
        if (missing.length > 0) {
          const patchRes = await fetch(githubRepoHookItemUrl(owner, repo, String(existing.id)), {
            method: 'PATCH',
            headers: {
              ...this.githubAuthHeader(opts.accessToken),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              events: Array.from(new Set([...ev, ...desiredEvents])),
            }),
          });
          if (!patchRes.ok) {
            const text = await patchRes.text().catch(() => '');
            this.logger.warn(`GitHub Webhook 更新 events 失败 HTTP ${patchRes.status}: ${text}`);
          }
        }
        return { remoteWebhookId: String(existing.id) };
      }
    }

    const res = await fetch(githubRepoHooksUrl(owner, repo), {
      method: 'POST',
      headers: {
        ...this.githubAuthHeader(opts.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: desiredEvents,
        config: {
          url: callbackUrl,
          content_type: 'json',
          secret: opts.webhookSecret,
          insecure_ssl: '0',
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitHub Webhook 注册失败 HTTP ${res.status}: ${text}`);
      return null;
    }

    const json = (await res.json()) as { id?: number };
    if (!json.id) return null;
    return { remoteWebhookId: String(json.id) };
  }

  private async unregisterGithubWebhook(opts: {
    repoFullName: string;
    accessToken: string;
    remoteWebhookId: string;
  }): Promise<void> {
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return;

    const res = await fetch(githubRepoHookItemUrl(owner, repo, opts.remoteWebhookId), {
      method: 'DELETE',
      headers: this.githubAuthHeader(opts.accessToken),
    });

    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitHub Webhook 注销失败 HTTP ${res.status}: ${text}`);
    }
  }

  private async registerGitlabWebhook(opts: {
    projectId: string;
    repoFullName: string;
    accessToken: string;
    baseUrl: string;
    webhookSecret: string;
  }): Promise<{ remoteWebhookId: string } | null> {
    const callbackUrl = this.webhookCallbackUrl(GitProvider.GITLAB, opts.projectId);
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 GitLab Webhook 自动注册');
      return null;
    }
    const enc = encodeURIComponent(opts.repoFullName);
    const pMark = `p=${opts.projectId}`;

    const listRes = await fetch(gitlabApiV4ProjectHooksUrl(opts.baseUrl, enc), {
      headers: { 'PRIVATE-TOKEN': opts.accessToken, Accept: 'application/json' },
    });
    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{ id?: number; url?: string }>;
      const existing = hooks.find((h) => h.url?.includes(pMark));
      if (existing?.id != null) return { remoteWebhookId: String(existing.id) };
    }

    const res = await fetch(gitlabApiV4ProjectHooksUrl(opts.baseUrl, enc), {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': opts.accessToken,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: callbackUrl,
        push_events: true,
        token: opts.webhookSecret,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitLab Webhook 注册失败 HTTP ${res.status}: ${text}`);
      return null;
    }
    const json = (await res.json()) as { id?: number };
    if (!json.id) return null;
    return { remoteWebhookId: String(json.id) };
  }

  private async unregisterGitlabWebhook(opts: {
    repoFullName: string;
    accessToken: string;
    baseUrl: string;
    remoteWebhookId: string;
  }): Promise<void> {
    const enc = encodeURIComponent(opts.repoFullName);
    const res = await fetch(
      gitlabApiV4ProjectHookItemUrl(opts.baseUrl, enc, opts.remoteWebhookId),
      {
        method: 'DELETE',
        headers: { 'PRIVATE-TOKEN': opts.accessToken },
      },
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitLab Webhook 注销失败 HTTP ${res.status}: ${text}`);
    }
  }

  private async registerGiteeWebhook(opts: {
    projectId: string;
    repoFullName: string;
    accessToken: string;
    webhookSecret: string;
  }): Promise<{ remoteWebhookId: string } | null> {
    const callbackUrl = this.webhookCallbackUrl(GitProvider.GITEE, opts.projectId);
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 Gitee Webhook 自动注册');
      return null;
    }
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return null;
    const pMark = `p=${opts.projectId}`;

    const listRes = await fetch(giteeRepoHooksListUrl(owner, repo, opts.accessToken), {
      headers: { Accept: 'application/json' },
    });
    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{ id?: number; url?: string }>;
      const existing = hooks.find((h) => h.url?.includes(pMark));
      if (existing?.id != null) return { remoteWebhookId: String(existing.id) };
    }

    const res = await fetch(giteeRepoHooksListUrl(owner, repo, opts.accessToken), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: callbackUrl,
        password: opts.webhookSecret,
        push_events: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitee Webhook 注册失败 HTTP ${res.status}: ${text}`);
      return null;
    }
    const json = (await res.json()) as { id?: number };
    if (!json.id) return null;
    return { remoteWebhookId: String(json.id) };
  }

  private async unregisterGiteeWebhook(opts: {
    repoFullName: string;
    accessToken: string;
    remoteWebhookId: string;
  }): Promise<void> {
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return;
    const res = await fetch(
      giteeRepoHookItemUrl(owner, repo, opts.remoteWebhookId, opts.accessToken),
      { method: 'DELETE' },
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitee Webhook 注销失败 HTTP ${res.status}: ${text}`);
    }
  }

  private async registerGiteaWebhook(opts: {
    projectId: string;
    repoFullName: string;
    accessToken: string;
    baseUrl: string;
    webhookSecret: string;
  }): Promise<{ remoteWebhookId: string } | null> {
    const callbackUrl = this.webhookCallbackUrl(GitProvider.GITEA, opts.projectId);
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 Gitea Webhook 自动注册');
      return null;
    }
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return null;
    const pMark = `p=${opts.projectId}`;

    const listRes = await fetch(giteaApiV1RepoHooksUrl(opts.baseUrl, owner, repo), {
      headers: { Authorization: `token ${opts.accessToken}`, Accept: 'application/json' },
    });
    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{ id?: number; config?: { url?: string } }>;
      const existing = hooks.find((h) => h.config?.url?.includes(pMark));
      if (existing?.id != null) return { remoteWebhookId: String(existing.id) };
    }

    const res = await fetch(giteaApiV1RepoHooksUrl(opts.baseUrl, owner, repo), {
      method: 'POST',
      headers: {
        Authorization: `token ${opts.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        active: true,
        branch_filter: '*',
        events: ['push'],
        type: GitProvider.GITEA,
        config: {
          url: callbackUrl,
          content_type: 'json',
          secret: opts.webhookSecret,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitea Webhook 注册失败 HTTP ${res.status}: ${text}`);
      return null;
    }
    const json = (await res.json()) as { id?: number };
    if (!json.id) return null;
    return { remoteWebhookId: String(json.id) };
  }

  private async unregisterGiteaWebhook(opts: {
    repoFullName: string;
    accessToken: string;
    baseUrl: string;
    remoteWebhookId: string;
  }): Promise<void> {
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return;
    const res = await fetch(
      giteaApiV1RepoHookItemUrl(opts.baseUrl, owner, repo, opts.remoteWebhookId),
      {
        method: 'DELETE',
        headers: { Authorization: `token ${opts.accessToken}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Gitea Webhook 注销失败 HTTP ${res.status}: ${text}`);
    }
  }

  async registerForProvider(opts: {
    projectId: string;
    gitProvider: string;
    repoFullName: string;
    accessToken: string;
    baseUrl: string | null;
    webhookSecret: string;
  }): Promise<{ remoteWebhookId: string } | null> {
    switch (opts.gitProvider) {
      case GitProvider.GITHUB:
        return this.registerGithubWebhook({
          projectId: opts.projectId,
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          webhookSecret: opts.webhookSecret,
        });
      case GitProvider.GITLAB: {
        const base = opts.baseUrl?.trim() || DEFAULT_GITLAB_BASE_URL;
        return this.registerGitlabWebhook({
          projectId: opts.projectId,
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          baseUrl: base,
          webhookSecret: opts.webhookSecret,
        });
      }
      case GitProvider.GITEE:
        return this.registerGiteeWebhook({
          projectId: opts.projectId,
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          webhookSecret: opts.webhookSecret,
        });
      case GitProvider.GITEA: {
        if (!opts.baseUrl?.trim()) return null;
        return this.registerGiteaWebhook({
          projectId: opts.projectId,
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          baseUrl: opts.baseUrl.trim(),
          webhookSecret: opts.webhookSecret,
        });
      }
      default:
        return null;
    }
  }

  async unregisterForProvider(opts: {
    gitProvider: string;
    repoFullName: string;
    accessToken: string;
    baseUrl: string | null;
    remoteWebhookId: string;
  }): Promise<void> {
    switch (opts.gitProvider) {
      case GitProvider.GITHUB:
        await this.unregisterGithubWebhook({
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          remoteWebhookId: opts.remoteWebhookId,
        });
        break;
      case GitProvider.GITLAB:
        await this.unregisterGitlabWebhook({
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          baseUrl: opts.baseUrl?.trim() || DEFAULT_GITLAB_BASE_URL,
          remoteWebhookId: opts.remoteWebhookId,
        });
        break;
      case GitProvider.GITEE:
        await this.unregisterGiteeWebhook({
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          remoteWebhookId: opts.remoteWebhookId,
        });
        break;
      case GitProvider.GITEA:
        if (opts.baseUrl?.trim()) {
          await this.unregisterGiteaWebhook({
            repoFullName: opts.repoFullName,
            accessToken: opts.accessToken,
            baseUrl: opts.baseUrl.trim(),
            remoteWebhookId: opts.remoteWebhookId,
          });
        }
        break;
      default:
        break;
    }
  }
}
