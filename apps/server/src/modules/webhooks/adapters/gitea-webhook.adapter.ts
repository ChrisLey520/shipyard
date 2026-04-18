import { createHash, createHmac } from 'crypto';
import type { ParsedPushPayload, ParsedPullRequestPayload } from '../webhook-types';

export function giteaWebhookIdempotencyKey(
  headers: Record<string, string>,
  rawBody: string,
): string {
  const delivery = (headers['x-gitea-delivery'] ?? headers['X-Gitea-Delivery'] ?? '').trim();
  if (delivery) return `webhook:gitea:${delivery}`;
  const h = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  return `webhook:gitea:body:${h}`;
}

export function verifyGiteaWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  const sig = signature.trim();
  if (!sig) return false;
  const prefix = 'sha256=';
  const hex = sig.startsWith(prefix) ? sig.slice(prefix.length) : sig;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return hex === expected;
}

export function parseGiteaWebhookEvent(headers: Record<string, string>): string {
  return (headers['x-gitea-event'] ?? headers['X-Gitea-Event'] ?? '').trim();
}

export function parseGiteaPushPayload(payload: Record<string, unknown>): ParsedPushPayload | null {
  const repo = payload['repository'] as { full_name?: string; owner?: { login?: string }; name?: string } | undefined;
  let repoFullName = repo?.full_name?.trim();
  if (!repoFullName && repo?.owner?.login && repo?.name) {
    repoFullName = `${repo.owner.login}/${repo.name}`;
  }
  if (!repoFullName) return null;

  const ref = String(payload['ref'] ?? '');
  if (!ref.startsWith('refs/heads/')) return null;
  const branch = ref.replace('refs/heads/', '');
  if (!branch) return null;

  const headCommit = payload['head_commit'] as { id?: string; message?: string; author?: { name?: string } } | undefined;
  const after = typeof payload['after'] === 'string' ? payload['after'] : '';
  const commitSha = headCommit?.id?.trim() || after.trim();
  if (!commitSha || commitSha === '0000000000000000000000000000000000000000') return null;

  return {
    repoFullName,
    branch,
    commitSha,
    commitMessage: headCommit?.message?.trim() || '',
    commitAuthor: headCommit?.author?.name?.trim() || '',
  };
}

/** Gitea pull_request 事件（载荷与 GitHub 相近） */
export function parseGiteaPullRequestPayload(
  payload: Record<string, unknown>,
): ParsedPullRequestPayload | null {
  const pr = payload['pull_request'] as
    | {
        number?: number;
        state?: string;
        title?: string;
        user?: { login?: string };
        head?: { ref?: string; sha?: string; repo?: { full_name?: string } };
        base?: { repo?: { full_name?: string } };
      }
    | undefined;
  if (!pr || typeof pr.number !== 'number') return null;

  const head = pr.head;
  const headSha = head?.sha?.trim();
  const headBranch = head?.ref?.trim();
  const headRepoFullName = head?.repo?.full_name?.trim();
  const baseRepoFullName = pr.base?.repo?.full_name?.trim();
  if (!headSha || !headBranch || !headRepoFullName || !baseRepoFullName) return null;

  const action = String(payload['action'] ?? '').trim();
  if (!action) return null;

  return {
    action,
    prNumber: pr.number,
    headSha,
    headBranch,
    headRepoFullName,
    baseRepoFullName,
    commitMessage: (pr.title ?? '').trim(),
    commitAuthor: (pr.user?.login ?? '').trim(),
    prState: (pr.state ?? 'open').trim(),
  };
}
