import { createHash } from 'crypto';
import type { ParsedPushPayload } from '../webhook-types';

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
