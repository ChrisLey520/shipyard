import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_GITLAB_BASE_URL, GitProvider, stripTrailingSlashes } from '@shipyard/shared';
import { GITEE_API_V5_BASE } from '../git-rest-api-urls';

const GITHUB_API = 'https://api.github.com';

@Injectable()
export class GitPrCommentApplicationService {
  private readonly logger = new Logger(GitPrCommentApplicationService.name);

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** 429 与 5xx 可重试；其余 4xx 不重试 */
  private isRetryableHttpStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  /** 有限次指数退避重试（网络错误与可重试 HTTP 状态） */
  private async httpFetchWithRetry(
    url: string,
    init: RequestInit,
    context: string,
  ): Promise<Response> {
    const maxAttempts = 3;
    let lastRes: Response | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(url, init);
        lastRes = res;
        if (res.ok) return res;
        if (!this.isRetryableHttpStatus(res.status) || attempt === maxAttempts) {
          return res;
        }
        const delayMs = 300 * 2 ** (attempt - 1);
        this.logger.warn(`${context} HTTP ${res.status}，${delayMs}ms 后重试 (${attempt}/${maxAttempts})`);
        await this.sleep(delayMs);
      } catch (e) {
        if (attempt === maxAttempts) {
          this.logger.warn(`${context} 网络失败: ${e}`);
          throw e;
        }
        const delayMs = 300 * 2 ** (attempt - 1);
        this.logger.warn(`${context} 网络异常，${delayMs}ms 后重试 (${attempt}/${maxAttempts}): ${e}`);
        await this.sleep(delayMs);
      }
    }
    return lastRes!;
  }

  /** 按平台写入/更新 PR/MR 预览评论（commentId 存远端 note/comment id 字符串） */
  async upsertPrPreviewComment(opts: {
    provider: string;
    repoFullName: string;
    prNumber: number;
    accessToken: string;
    baseUrl: string | null;
    body: string;
    existingCommentId?: string | null;
  }): Promise<string | null> {
    switch (opts.provider) {
      case GitProvider.GITHUB:
        return this.upsertGithubIssueComment({
          repoFullName: opts.repoFullName,
          prNumber: opts.prNumber,
          accessToken: opts.accessToken,
          body: opts.body,
          existingCommentId: opts.existingCommentId,
        });
      case GitProvider.GITLAB:
        return this.upsertGitlabMrNote(opts);
      case GitProvider.GITEE:
        return this.upsertGiteePullComment(opts);
      case GitProvider.GITEA:
        return this.upsertGiteaIssueCommentOnPull(opts);
      default:
        return null;
    }
  }

  /** GitHub：对 PR 发评论或更新已有评论，返回 comment id（失败返回 null） */
  async upsertGithubIssueComment(opts: {
    repoFullName: string;
    prNumber: number;
    accessToken: string;
    body: string;
    existingCommentId?: string | null;
  }): Promise<string | null> {
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return null;

    const headers = {
      Authorization: `Bearer ${opts.accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      if (opts.existingCommentId?.trim()) {
        const cid = opts.existingCommentId.trim();
        const patchUrl = `${GITHUB_API}/repos/${owner}/${repo}/issues/comments/${cid}`;
        const patchInit: RequestInit = {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: opts.body }),
        };
        const res = await this.httpFetchWithRetry(patchUrl, patchInit, 'GitHub PATCH comment');
        if (res.ok) return cid;
        if (res.status === 404) {
          const t = await res.text().catch(() => '');
          this.logger.warn(`GitHub PATCH comment 404（评论已删），将 POST 新评论: ${t}`);
        } else {
          const t = await res.text().catch(() => '');
          this.logger.warn(`GitHub PATCH comment HTTP ${res.status}: ${t}`);
          return null;
        }
      }

      const postUrl = `${GITHUB_API}/repos/${owner}/${repo}/issues/${opts.prNumber}/comments`;
      const postInit: RequestInit = {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: opts.body }),
      };
      const res = await this.httpFetchWithRetry(postUrl, postInit, 'GitHub POST PR comment');
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        this.logger.warn(`GitHub POST PR comment HTTP ${res.status}: ${t}`);
        return null;
      }
      const json = (await res.json()) as { id?: number };
      return json.id != null ? String(json.id) : null;
    } catch (e) {
      this.logger.warn(`GitHub PR comment failed: ${e}`);
      return null;
    }
  }

  private async upsertGitlabMrNote(opts: {
    repoFullName: string;
    prNumber: number;
    accessToken: string;
    baseUrl: string | null;
    body: string;
    existingCommentId?: string | null;
  }): Promise<string | null> {
    const base = stripTrailingSlashes(opts.baseUrl?.trim() || DEFAULT_GITLAB_BASE_URL);
    const enc = encodeURIComponent(opts.repoFullName);
    const root = `${base}/api/v4`;
    const headers = {
      'PRIVATE-TOKEN': opts.accessToken,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    try {
      if (opts.existingCommentId?.trim()) {
        const nid = opts.existingCommentId.trim();
        const putUrl = `${root}/projects/${enc}/merge_requests/${opts.prNumber}/notes/${encodeURIComponent(nid)}`;
        const putInit: RequestInit = {
          method: 'PUT',
          headers,
          body: JSON.stringify({ body: opts.body }),
        };
        const res = await this.httpFetchWithRetry(putUrl, putInit, 'GitLab PUT MR note');
        if (res.ok) return nid;
        if (res.status === 404) {
          const t = await res.text().catch(() => '');
          this.logger.warn(`GitLab MR note 404，将 POST 新 note: ${t}`);
        } else {
          const t = await res.text().catch(() => '');
          this.logger.warn(`GitLab PUT MR note HTTP ${res.status}: ${t}`);
          return null;
        }
      }

      const postUrl = `${root}/projects/${enc}/merge_requests/${opts.prNumber}/notes`;
      const postInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: opts.body }),
      };
      const res = await this.httpFetchWithRetry(postUrl, postInit, 'GitLab POST MR note');
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        this.logger.warn(`GitLab POST MR note HTTP ${res.status}: ${t}`);
        return null;
      }
      const json = (await res.json()) as { id?: number };
      return json.id != null ? String(json.id) : null;
    } catch (e) {
      this.logger.warn(`GitLab MR note failed: ${e}`);
      return null;
    }
  }

  private async upsertGiteePullComment(opts: {
    repoFullName: string;
    prNumber: number;
    accessToken: string;
    body: string;
    existingCommentId?: string | null;
  }): Promise<string | null> {
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return null;
    const t = encodeURIComponent(opts.accessToken);
    const repoBase = `${GITEE_API_V5_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

    try {
      if (opts.existingCommentId?.trim()) {
        const cid = opts.existingCommentId.trim();
        const patchUrl = `${repoBase}/pulls/comments/${encodeURIComponent(cid)}?access_token=${t}`;
        const patchInit: RequestInit = {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ body: opts.body }),
        };
        const res = await this.httpFetchWithRetry(patchUrl, patchInit, 'Gitee PATCH pull comment');
        if (res.ok) return cid;
        if (res.status === 404) {
          const tx = await res.text().catch(() => '');
          this.logger.warn(`Gitee pull comment 404，将 POST 新评论: ${tx}`);
        } else {
          const tx = await res.text().catch(() => '');
          this.logger.warn(`Gitee PATCH pull comment HTTP ${res.status}: ${tx}`);
          return null;
        }
      }

      const postUrl = `${repoBase}/pulls/${opts.prNumber}/comments?access_token=${t}`;
      const postInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: opts.body }),
      };
      const res = await this.httpFetchWithRetry(postUrl, postInit, 'Gitee POST pull comment');
      if (!res.ok) {
        const tx = await res.text().catch(() => '');
        this.logger.warn(`Gitee POST pull comment HTTP ${res.status}: ${tx}`);
        return null;
      }
      const json = (await res.json()) as { id?: number };
      return json.id != null ? String(json.id) : null;
    } catch (e) {
      this.logger.warn(`Gitee pull comment failed: ${e}`);
      return null;
    }
  }

  private async upsertGiteaIssueCommentOnPull(opts: {
    repoFullName: string;
    prNumber: number;
    accessToken: string;
    baseUrl: string | null;
    body: string;
    existingCommentId?: string | null;
  }): Promise<string | null> {
    if (!opts.baseUrl?.trim()) return null;
    const base = stripTrailingSlashes(opts.baseUrl.trim());
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return null;
    const auth = { Authorization: `token ${opts.accessToken}`, Accept: 'application/json' };
    const headers = { ...auth, 'Content-Type': 'application/json' };
    const repoBase = `${base}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    try {
      if (opts.existingCommentId?.trim()) {
        const cid = opts.existingCommentId.trim();
        const patchUrl = `${repoBase}/issues/comments/${encodeURIComponent(cid)}`;
        const patchInit: RequestInit = {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ body: opts.body }),
        };
        const res = await this.httpFetchWithRetry(patchUrl, patchInit, 'Gitea PATCH issue comment');
        if (res.ok) return cid;
        if (res.status === 404) {
          const tx = await res.text().catch(() => '');
          this.logger.warn(`Gitea issue comment 404，将 POST 新评论: ${tx}`);
        } else {
          const tx = await res.text().catch(() => '');
          this.logger.warn(`Gitea PATCH issue comment HTTP ${res.status}: ${tx}`);
          return null;
        }
      }

      const postUrl = `${repoBase}/issues/${opts.prNumber}/comments`;
      const postInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: opts.body }),
      };
      const res = await this.httpFetchWithRetry(postUrl, postInit, 'Gitea POST issue comment');
      if (!res.ok) {
        const tx = await res.text().catch(() => '');
        this.logger.warn(`Gitea POST issue comment HTTP ${res.status}: ${tx}`);
        return null;
      }
      const json = (await res.json()) as { id?: number };
      return json.id != null ? String(json.id) : null;
    } catch (e) {
      this.logger.warn(`Gitea PR comment failed: ${e}`);
      return null;
    }
  }
}
