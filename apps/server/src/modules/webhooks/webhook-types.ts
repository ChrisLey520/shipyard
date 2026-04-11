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

/** GitHub pull_request webhook 统一形状（M1 仅 GitHub） */
export interface ParsedGithubPullRequestPayload {
  action: string;
  prNumber: number;
  headSha: string;
  headBranch: string;
  headRepoFullName: string;
  baseRepoFullName: string;
  commitMessage: string;
  commitAuthor: string;
  /** pull_request.state：open / closed */
  prState: string;
}
