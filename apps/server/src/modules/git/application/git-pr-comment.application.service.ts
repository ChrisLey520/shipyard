import { Injectable, Logger } from '@nestjs/common';

const GITHUB_API = 'https://api.github.com';

@Injectable()
export class GitPrCommentApplicationService {
  private readonly logger = new Logger(GitPrCommentApplicationService.name);

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
        const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/comments/${cid}`;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: opts.body }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          this.logger.warn(`GitHub PATCH comment HTTP ${res.status}: ${t}`);
          return cid;
        }
        return cid;
      }

      const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${opts.prNumber}/comments`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: opts.body }),
      });
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
