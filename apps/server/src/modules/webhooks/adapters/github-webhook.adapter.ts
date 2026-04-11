import { createHash, createHmac } from 'crypto';
import type { ParsedGithubPullRequestPayload, ParsedPushPayload } from '../webhook-types';

export function githubWebhookIdempotencyKey(
  headers: Record<string, string>,
  rawBody: string,
): string {
  const delivery = (headers['x-github-delivery'] ?? headers['X-GitHub-Delivery'] ?? '').trim();
  if (delivery) return `webhook:github:${delivery}`;
  const h = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  return `webhook:github:body:${h}`;
}

export function verifyGithubWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  const sig = signature.trim();
  if (!sig) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  return sig === expected;
}

export function parseGithubWebhookEvent(headers: Record<string, string>): string {
  return (headers['x-github-event'] ?? headers['X-GitHub-Event'] ?? '').trim();
}

export function parseGithubPushPayload(payload: Record<string, unknown>): ParsedPushPayload | null {
  const repo = payload['repository'] as { full_name?: string } | undefined;
  const repoFullName = repo?.full_name?.trim();
  if (!repoFullName) return null;

  const ref = String(payload['ref'] ?? '');
  if (!ref.startsWith('refs/heads/')) return null;
  const branch = ref.replace('refs/heads/', '');
  if (!branch) return null;

  const commits = payload['commits'] as Array<{ id: string; message: string; author: { name: string } }> | undefined;
  const headCommit =
    (payload['head_commit'] as { id: string; message: string; author: { name: string } } | undefined) ??
    commits?.[0];
  const after = typeof payload['after'] === 'string' ? (payload['after'] as string) : '';
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

export function parseGithubPullRequestPayload(
  payload: Record<string, unknown>,
): ParsedGithubPullRequestPayload | null {
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
