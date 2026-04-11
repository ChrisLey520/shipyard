import { Injectable, Logger } from '@nestjs/common';

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
  private async githubFetchWithRetry(
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
        const res = await this.githubFetchWithRetry(patchUrl, patchInit, 'GitHub PATCH comment');
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
      const res = await this.githubFetchWithRetry(postUrl, postInit, 'GitHub POST PR comment');
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
}