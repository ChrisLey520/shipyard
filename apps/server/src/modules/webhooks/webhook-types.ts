import type { GitProvider } from '@shipyard/shared';

export type WebhooksGitProvider = GitProvider;

export type WebhookErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'invalid_signature'
  | 'repository_mismatch'
  | 'service_unavailable';

export interface WebhookHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface ParsedPushPayload {
  repoFullName: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  commitAuthor: string;
}
