import { createHash } from 'crypto';
import type { ParsedPushPayload, ParsedPullRequestPayload } from '../webhook-types';

function secretEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  if (ha.length !== hb.length) return false;
  let x = 0;
  for (let i = 0; i < ha.length; i++) x |= ha[i]! ^ hb[i]!;
  return x === 0;
}

export function gitlabWebhookIdempotencyKey(
  headers: Record<string, string>,
  payload: Record<string, unknown>,
): string {
  const uuid = (headers['x-gitlab-event-uuid'] ?? headers['X-Gitlab-Event-UUID'] ?? '').trim();
  if (uuid) return `webhook:gitlab:${uuid}`;
  if (String(payload['object_kind'] ?? '').trim() === 'merge_request') {
    const oa = payload['object_attributes'] as
      | { id?: number; action?: string; updated_at?: string }
      | undefined;
    if (oa?.id != null) {
      return `webhook:gitlab:mr:${oa.id}:${oa.action ?? ''}:${oa.updated_at ?? ''}`;
    }
  }
  const event = String(payload['event_name'] ?? '');
  const pid = String(payload['project_id'] ?? '');
  const after = String(payload['after'] ?? '');
  const ref = String(payload['ref'] ?? '');
  const h = createHash('sha256').update(`${event}:${pid}:${after}:${ref}`).digest('hex');
  return `webhook:gitlab:hash:${h}`;
}

export function verifyGitlabWebhookToken(
  secret: string,
  headers: Record<string, string>,
): boolean {
  const token = (headers['x-gitlab-token'] ?? headers['X-Gitlab-Token'] ?? '').trim();
  if (!token || !secret) return false;
  return secretEqual(token, secret);
}

export function parseGitlabWebhookEvent(headers: Record<string, string>): string {
  return (headers['x-gitlab-event'] ?? headers['X-Gitlab-Event'] ?? '').trim();
}

export function parseGitlabPushPayload(payload: Record<string, unknown>): ParsedPushPayload | null {
  const project = payload['project'] as { path_with_namespace?: string } | undefined;
  const repoFullName = project?.path_with_namespace?.trim();
  if (!repoFullName) return null;

  const ref = String(payload['ref'] ?? '');
  if (!ref.startsWith('refs/heads/')) return null;
  const branch = ref.replace('refs/heads/', '');
  if (!branch) return null;

  const after = typeof payload['after'] === 'string' ? payload['after'] : '';
  const checkoutSha = typeof payload['checkout_sha'] === 'string' ? payload['checkout_sha'] : '';
  const commitSha = (checkoutSha || after).trim();
  if (!commitSha || commitSha.startsWith('0000000')) return null;

  const commits = payload['commits'] as Array<{ message?: string; author?: { name?: string } }> | undefined;
  const first = commits?.[0];
  return {
    repoFullName,
    branch,
    commitSha,
    commitMessage: first?.message?.trim() || '',
    commitAuthor: first?.author?.name?.trim() || '',
  };
}

/** GitLab Merge Request Hook（object_kind=merge_request） */
export function parseGitlabMergeRequestPayload(
  payload: Record<string, unknown>,
): ParsedPullRequestPayload | null {
  if (String(payload['object_kind'] ?? '').trim() !== 'merge_request') return null;
  const oa = payload['object_attributes'] as Record<string, unknown> | undefined;
  if (!oa) return null;

  const action = String(oa['action'] ?? '').trim();
  if (!action) return null;

  const rawIid = oa['iid'];
  const iid = typeof rawIid === 'number' ? rawIid : Number(rawIid);
  if (!Number.isFinite(iid) || iid < 1) return null;

  const sourceBranch = String(oa['source_branch'] ?? '').trim();
  const lastCommit = oa['last_commit'] as { id?: string } | undefined;
  const headShaFinal =
    lastCommit?.id?.trim() ||
    (typeof oa['sha'] === 'string' ? oa['sha'].trim() : '') ||
    String(oa['last_commit_id'] ?? '').trim();
  if (!headShaFinal || !sourceBranch) return null;

  const project = payload['project'] as { path_with_namespace?: string } | undefined;
  const baseRepoFullName = project?.path_with_namespace?.trim();
  if (!baseRepoFullName) return null;

  const sourcePid = Number(oa['source_project_id']);
  const targetPid = Number(oa['target_project_id']);
  let headRepoFullName = baseRepoFullName;
  if (Number.isFinite(sourcePid) && Number.isFinite(targetPid) && sourcePid !== targetPid) {
    const src = payload['source'] as { path_with_namespace?: string } | undefined;
    const fromSrc = src?.path_with_namespace?.trim();
    if (fromSrc) headRepoFullName = fromSrc;
  }

  const title = String(oa['title'] ?? '').trim();
  const user = payload['user'] as { username?: string; name?: string } | undefined;
  const commitAuthor = (user?.username ?? user?.name ?? '').trim();

  const stateRaw = String(oa['state'] ?? 'opened').trim();

  return {
    action,
    prNumber: iid,
    headSha: headShaFinal,
    headBranch: sourceBranch,
    headRepoFullName,
    baseRepoFullName,
    commitMessage: title || '(no title)',
    commitAuthor: commitAuthor || 'unknown',
    prState: stateRaw,
  };
}
