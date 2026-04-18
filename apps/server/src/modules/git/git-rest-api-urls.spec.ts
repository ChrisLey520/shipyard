import { describe, expect, it } from 'vitest';
import {
  GITHUB_REST_API_BASE,
  GITHUB_REST_API_USER_URL,
  GITEE_API_V5_BASE,
  githubCommitStatusPostUrl,
  githubRepoBranchesListUrl,
  githubRepoHookItemUrl,
  githubRepoHooksUrl,
  githubUserReposListUrl,
  giteeCommitStatusPostUrl,
  giteeRepoHookItemUrl,
  giteeApiV5UserUrl,
  giteeRepoHooksListUrl,
  giteeUserReposListUrl,
  gitlabApiV4MembershipProjectsUrl,
  gitlabApiV4ProjectHookItemUrl,
  gitlabApiV4ProjectHooksUrl,
  gitlabApiV4ProjectRepositoryBranchesUrl,
  gitlabCommitStatusPostUrl,
  giteaApiV1RepoBranchesUrl,
  giteaApiV1RepoHookItemUrl,
  giteaApiV1RepoHooksUrl,
  giteaApiV1UserReposUrl,
  giteaCommitStatusPostUrl,
  withNormalizedGitBase,
} from './git-rest-api-urls';

describe('git-rest-api-urls', () => {
  it('GitHub 列表与分支 URL 使用 api.github.com', () => {
    expect(GITHUB_REST_API_USER_URL).toBe(`${GITHUB_REST_API_BASE}/user`);
    expect(githubUserReposListUrl()).toBe(`${GITHUB_REST_API_BASE}/user/repos?per_page=100&sort=updated`);
    expect(githubRepoBranchesListUrl('acme', 'demo')).toBe(
      `${GITHUB_REST_API_BASE}/repos/acme/demo/branches?per_page=100`,
    );
    expect(githubRepoHooksUrl('a', 'b')).toBe(`${GITHUB_REST_API_BASE}/repos/a/b/hooks`);
    expect(githubRepoHookItemUrl('a', 'b', '1')).toBe(`${GITHUB_REST_API_BASE}/repos/a/b/hooks/1`);
    expect(githubCommitStatusPostUrl('a', 'b', 'dead')).toBe(
      `${GITHUB_REST_API_BASE}/repos/a/b/statuses/dead`,
    );
  });

  it('Gitee v5 URL 含编码后的 token 与路径段', () => {
    const tok = 'a/b';
    expect(giteeApiV5UserUrl(tok)).toBe(`${GITEE_API_V5_BASE}/user?access_token=${encodeURIComponent(tok)}`);
    expect(giteeUserReposListUrl(tok)).toContain(encodeURIComponent(tok));
    expect(giteeUserReposListUrl(tok)).toContain(`${GITEE_API_V5_BASE}/user/repos`);
    expect(giteeRepoHooksListUrl('o', 'r', tok)).toBe(
      `${GITEE_API_V5_BASE}/repos/o/r/hooks?access_token=${encodeURIComponent(tok)}`,
    );
    expect(giteeRepoHookItemUrl('o', 'r', '99', tok)).toBe(
      `${GITEE_API_V5_BASE}/repos/o/r/hooks/99?access_token=${encodeURIComponent(tok)}`,
    );
    expect(giteeCommitStatusPostUrl('o', 'r', 'abc', tok)).toBe(
      `${GITEE_API_V5_BASE}/repos/o/r/statuses/abc?access_token=${encodeURIComponent(tok)}`,
    );
  });

  it('GitLab / Gitea 实例 base 去尾斜杠并拼接 REST 路径', () => {
    expect(withNormalizedGitBase('https://h/', '/p')).toBe('https://h/p');

    const gl = 'https://gitlab.test/';
    const enc = encodeURIComponent('group/repo');
    expect(gitlabApiV4MembershipProjectsUrl(gl)).toBe(
      'https://gitlab.test/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at',
    );
    expect(gitlabApiV4ProjectRepositoryBranchesUrl(gl, enc)).toBe(
      `https://gitlab.test/api/v4/projects/${enc}/repository/branches?per_page=100`,
    );
    expect(gitlabApiV4ProjectHooksUrl(gl, enc)).toBe(`https://gitlab.test/api/v4/projects/${enc}/hooks`);
    expect(gitlabApiV4ProjectHookItemUrl(gl, enc, '7')).toBe(
      `https://gitlab.test/api/v4/projects/${enc}/hooks/7`,
    );
    expect(gitlabCommitStatusPostUrl(gl, enc, 'sha1')).toBe(
      `https://gitlab.test/api/v4/projects/${enc}/statuses/sha1`,
    );

    const gt = 'https://gitea.test';
    expect(giteaApiV1UserReposUrl(gt)).toBe('https://gitea.test/api/v1/user/repos?limit=100');
    expect(giteaApiV1RepoBranchesUrl(gt, 'o', 'r')).toBe(
      'https://gitea.test/api/v1/repos/o/r/branches?limit=100',
    );
    expect(giteaApiV1RepoHooksUrl(gt, 'o', 'r')).toBe('https://gitea.test/api/v1/repos/o/r/hooks');
    expect(giteaApiV1RepoHookItemUrl(gt, 'o', 'r', '3')).toBe(
      'https://gitea.test/api/v1/repos/o/r/hooks/3',
    );
    expect(giteaCommitStatusPostUrl(gt, 'o', 'r', 'abc')).toBe(
      'https://gitea.test/api/v1/repos/o/r/statuses/abc',
    );
  });
});
