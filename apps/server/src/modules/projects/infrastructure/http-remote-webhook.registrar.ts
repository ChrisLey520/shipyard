import { Injectable, Logger } from '@nestjs/common';
import type { RemoteWebhookRegistrar } from '../application/ports/remote-webhook.registrar.port';

@Injectable()
export class HttpRemoteWebhookRegistrar implements RemoteWebhookRegistrar {
  private readonly logger = new Logger(HttpRemoteWebhookRegistrar.name);

  private getServerPublicUrl(): string | null {
    const url = process.env['SERVER_PUBLIC_URL']?.trim();
    if (!url) return null;
    return url.endsWith('/') ? url.slice(0, -1) : null;
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
    const callbackUrl = this.webhookCallbackUrl('github', opts.projectId);
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
    const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      headers: this.githubAuthHeader(opts.accessToken),
    });
    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{ id?: number; config?: { url?: string } }>;
      const existing = hooks.find((h) => h.config?.url?.includes(pMark));
      if (existing?.id != null) {
        return { remoteWebhookId: String(existing.id) };
      }
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        ...this.githubAuthHeader(opts.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push'],
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

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${opts.remoteWebhookId}`, {
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
    const callbackUrl = this.webhookCallbackUrl('gitlab', opts.projectId);
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 GitLab Webhook 自动注册');
      return null;
    }
    const apiBase = opts.baseUrl.replace(/\/$/, '');
    const enc = encodeURIComponent(opts.repoFullName);
    const pMark = `p=${opts.projectId}`;

    const listRes = await fetch(`${apiBase}/api/v4/projects/${enc}/hooks`, {
      headers: { 'PRIVATE-TOKEN': opts.accessToken, Accept: 'application/json' },
    });
    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{ id?: number; url?: string }>;
      const existing = hooks.find((h) => h.url?.includes(pMark));
      if (existing?.id != null) return { remoteWebhookId: String(existing.id) };
    }

    const res = await fetch(`${apiBase}/api/v4/projects/${enc}/hooks`, {
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
    const apiBase = opts.baseUrl.replace(/\/$/, '');
    const enc = encodeURIComponent(opts.repoFullName);
    const res = await fetch(`${apiBase}/api/v4/projects/${enc}/hooks/${opts.remoteWebhookId}`, {
      method: 'DELETE',
      headers: { 'PRIVATE-TOKEN': opts.accessToken },
    });
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
    const callbackUrl = this.webhookCallbackUrl('gitee', opts.projectId);
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 Gitee Webhook 自动注册');
      return null;
    }
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return null;
    const pMark = `p=${opts.projectId}`;
    const tok = encodeURIComponent(opts.accessToken);

    const listRes = await fetch(
      `https://gitee.com/api/v5/repos/${owner}/${repo}/hooks?access_token=${tok}`,
      { headers: { Accept: 'application/json' } },
    );
    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{ id?: number; url?: string }>;
      const existing = hooks.find((h) => h.url?.includes(pMark));
      if (existing?.id != null) return { remoteWebhookId: String(existing.id) };
    }

    const res = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/hooks?access_token=${tok}`, {
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
    const tok = encodeURIComponent(opts.accessToken);
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${owner}/${repo}/hooks/${opts.remoteWebhookId}?access_token=${tok}`,
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
    const callbackUrl = this.webhookCallbackUrl('gitea', opts.projectId);
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 Gitea Webhook 自动注册');
      return null;
    }
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return null;
    const apiBase = opts.baseUrl.replace(/\/$/, '');
    const pMark = `p=${opts.projectId}`;

    const listRes = await fetch(`${apiBase}/api/v1/repos/${owner}/${repo}/hooks`, {
      headers: { Authorization: `token ${opts.accessToken}`, Accept: 'application/json' },
    });
    if (listRes.ok) {
      const hooks = (await listRes.json()) as Array<{ id?: number; config?: { url?: string } }>;
      const existing = hooks.find((h) => h.config?.url?.includes(pMark));
      if (existing?.id != null) return { remoteWebhookId: String(existing.id) };
    }

    const res = await fetch(`${apiBase}/api/v1/repos/${owner}/${repo}/hooks`, {
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
        type: 'gitea',
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
    const apiBase = opts.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${apiBase}/api/v1/repos/${owner}/${repo}/hooks/${opts.remoteWebhookId}`, {
      method: 'DELETE',
      headers: { Authorization: `token ${opts.accessToken}` },
    });
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
      case 'github':
        return this.registerGithubWebhook({
          projectId: opts.projectId,
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          webhookSecret: opts.webhookSecret,
        });
      case 'gitlab': {
        const base = opts.baseUrl?.trim() || 'https://gitlab.com';
        return this.registerGitlabWebhook({
          projectId: opts.projectId,
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          baseUrl: base,
          webhookSecret: opts.webhookSecret,
        });
      }
      case 'gitee':
        return this.registerGiteeWebhook({
          projectId: opts.projectId,
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          webhookSecret: opts.webhookSecret,
        });
      case 'gitea': {
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
      case 'github':
        await this.unregisterGithubWebhook({
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          remoteWebhookId: opts.remoteWebhookId,
        });
        break;
      case 'gitlab':
        await this.unregisterGitlabWebhook({
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          baseUrl: opts.baseUrl?.trim() || 'https://gitlab.com',
          remoteWebhookId: opts.remoteWebhookId,
        });
        break;
      case 'gitee':
        await this.unregisterGiteeWebhook({
          repoFullName: opts.repoFullName,
          accessToken: opts.accessToken,
          remoteWebhookId: opts.remoteWebhookId,
        });
        break;
      case 'gitea':
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
