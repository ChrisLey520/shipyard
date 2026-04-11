/**
 * Git REST API（仓库列表、分支、Webhook、Commit Status 等）URL 构建。
 * 固定主机：GitHub api.github.com、Gitee api/v5；GitLab / Gitea 由实例 base + 下列前缀拼接。
 */

import { stripTrailingSlashes } from '@shipyard/shared';

/** 自托管 GitLab HTTP API 路径前缀 */
export const GITLAB_API_V4_PREFIX = '/api/v4';

/** 自托管 Gitea HTTP API 路径前缀 */
export const GITEA_API_V1_PREFIX = '/api/v1';

export function withNormalizedGitBase(host: string, path: string): string {
  return `${stripTrailingSlashes(host)}${path}`;
}

// --- GitLab（实例 base + /api/v4）---

export function gitlabApiV4MembershipProjectsUrl(host: string): string {
  return withNormalizedGitBase(
    host,
    `${GITLAB_API_V4_PREFIX}/projects?membership=true&per_page=100&order_by=last_activity_at`,
  );
}

export function gitlabApiV4ProjectRepositoryBranchesUrl(host: string, projectPathEncoded: string): string {
  return withNormalizedGitBase(
    host,
    `${GITLAB_API_V4_PREFIX}/projects/${projectPathEncoded}/repository/branches?per_page=100`,
  );
}

export function gitlabApiV4ProjectHooksUrl(host: string, projectPathEncoded: string): string {
  return withNormalizedGitBase(host, `${GITLAB_API_V4_PREFIX}/projects/${projectPathEncoded}/hooks`);
}

export function gitlabApiV4ProjectHookItemUrl(
  host: string,
  projectPathEncoded: string,
  hookId: string,
): string {
  return withNormalizedGitBase(
    host,
    `${GITLAB_API_V4_PREFIX}/projects/${projectPathEncoded}/hooks/${encodeURIComponent(hookId)}`,
  );
}

export function gitlabCommitStatusPostUrl(host: string, projectPathEncoded: string, sha: string): string {
  return withNormalizedGitBase(
    host,
    `${GITLAB_API_V4_PREFIX}/projects/${projectPathEncoded}/statuses/${encodeURIComponent(sha)}`,
  );
}

// --- Gitea（实例 base + /api/v1）---

export function giteaApiV1UserReposUrl(host: string): string {
  return withNormalizedGitBase(host, `${GITEA_API_V1_PREFIX}/user/repos?limit=100`);
}

export function giteaApiV1RepoBranchesUrl(host: string, owner: string, repo: string): string {
  return withNormalizedGitBase(
    host,
    `${GITEA_API_V1_PREFIX}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?limit=100`,
  );
}

export function giteaApiV1RepoHooksUrl(host: string, owner: string, repo: string): string {
  return withNormalizedGitBase(
    host,
    `${GITEA_API_V1_PREFIX}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`,
  );
}

export function giteaApiV1RepoHookItemUrl(host: string, owner: string, repo: string, hookId: string): string {
  return withNormalizedGitBase(
    host,
    `${GITEA_API_V1_PREFIX}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${encodeURIComponent(hookId)}`,
  );
}

export function giteaCommitStatusPostUrl(host: string, owner: string, repo: string, sha: string): string {
  return withNormalizedGitBase(
    host,
    `${GITEA_API_V1_PREFIX}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/statuses/${encodeURIComponent(sha)}`,
  );
}

export const GITHUB_REST_API_BASE = 'https://api.github.com';

/** GET /user（OAuth 换票后拉取用户信息与 PAT 场景共用根路径） */
export const GITHUB_REST_API_USER_URL = `${GITHUB_REST_API_BASE}/user`;

export function githubUserReposListUrl(): string {
  return `${GITHUB_REST_API_BASE}/user/repos?per_page=100&sort=updated`;
}

export function githubRepoBranchesListUrl(owner: string, repo: string): string {
  return `${GITHUB_REST_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`;
}

export function githubRepoHooksUrl(owner: string, repo: string): string {
  return `${GITHUB_REST_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`;
}

export function githubRepoHookItemUrl(owner: string, repo: string, hookId: string): string {
  return `${GITHUB_REST_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${encodeURIComponent(hookId)}`;
}

export function githubCommitStatusPostUrl(owner: string, repo: string, sha: string): string {
  return `${GITHUB_REST_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/statuses/${encodeURIComponent(sha)}`;
}

/** 公有 Gitee OpenAPI v5 根路径 */
export const GITEE_API_V5_BASE = 'https://gitee.com/api/v5';

export function giteeApiV5UserUrl(accessToken: string): string {
  return `${GITEE_API_V5_BASE}/user?access_token=${encodeURIComponent(accessToken)}`;
}

export function giteeUserReposListUrl(accessToken: string): string {
  const t = encodeURIComponent(accessToken);
  return `${GITEE_API_V5_BASE}/user/repos?access_token=${t}&per_page=100&sort=updated`;
}

export function giteeRepoBranchesListUrl(owner: string, repo: string, accessToken: string): string {
  const t = encodeURIComponent(accessToken);
  return `${GITEE_API_V5_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?access_token=${t}&per_page=100`;
}

export function giteeRepoHooksListUrl(owner: string, repo: string, accessToken: string): string {
  const t = encodeURIComponent(accessToken);
  return `${GITEE_API_V5_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks?access_token=${t}`;
}

export function giteeRepoHookItemUrl(
  owner: string,
  repo: string,
  hookId: string,
  accessToken: string,
): string {
  const t = encodeURIComponent(accessToken);
  return `${GITEE_API_V5_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${encodeURIComponent(hookId)}?access_token=${t}`;
}

export function giteeCommitStatusPostUrl(
  owner: string,
  repo: string,
  sha: string,
  accessToken: string,
): string {
  const t = encodeURIComponent(accessToken);
  return `${GITEE_API_V5_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/statuses/${encodeURIComponent(sha)}?access_token=${t}`;
}
