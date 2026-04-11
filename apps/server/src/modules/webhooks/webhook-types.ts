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

/** 各平台 MR/PR Webhook 归一化形状（GitHub pull_request / GitLab MR / Gitee / Gitea） */
export interface ParsedPullRequestPayload {
  action: string;
  prNumber: number;
  headSha: string;
  headBranch: string;
  headRepoFullName: string;
  baseRepoFullName: string;
  commitMessage: string;
  commitAuthor: string;
  /** MR/PR 状态：opened / closed / merged 等 */
  prState: string;
}

/** @deprecated 使用 ParsedPullRequestPayload */
export type ParsedGithubPullRequestPayload = ParsedPullRequestPayload;
