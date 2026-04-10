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

export function giteeWebhookIdempotencyKey(payload: Record<string, unknown>): string {
  const repoId = String((payload['repository'] as { id?: number } | undefined)?.id ?? '');
  const head = payload['head_commit'] as { id?: string } | undefined;
  const sha = String(head?.id ?? (payload['after'] as string | undefined) ?? '');
  const event = String(payload['hook_name'] ?? payload['action'] ?? '');
  return `webhook:gitee:${createHash('sha256').update(`${event}:${repoId}:${sha}`).digest('hex')}`;
}

export function verifyGiteeWebhookToken(secret: string, headers: Record<string, string>): boolean {
  const token = (headers['x-gitee-token'] ?? headers['X-Gitee-Token'] ?? '').trim();
  if (!token || !secret) return false;
  return secretEqual(token, secret);
}

export function parseGiteePushPayload(payload: Record<string, unknown>): ParsedPushPayload | null {
  const hookName = String(payload['hook_name'] ?? '');
  if (hookName && hookName !== 'push_hooks') return null;

  const repo = payload['repository'] as { full_name?: string } | undefined;
  const repoFullName = repo?.full_name?.trim();
  if (!repoFullName) return null;

  const ref = String(payload['ref'] ?? '');
  if (!ref.startsWith('refs/heads/')) return null;
  const branch = ref.replace('refs/heads/', '');
  if (!branch) return null;

  const headCommit = payload['head_commit'] as { id?: string; message?: string; author?: { name?: string } } | undefined;
  const after = typeof payload['after'] === 'string' ? payload['after'] : '';
  const commitSha = (headCommit?.id?.trim() || after.trim());
  if (!commitSha) return null;

  return {
    repoFullName,
    branch,
    commitSha,
    commitMessage: headCommit?.message?.trim() || '',
    commitAuthor: headCommit?.author?.name?.trim() || '',
  };
}
