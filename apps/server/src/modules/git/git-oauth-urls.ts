/**
 * Git OAuth / 用户信息 API 端点集中定义（避免字面量散落）。
 * 自托管 GitLab / Gitea 使用规范 base URL + 相对路径拼接。
 */

import {
  GITHUB_REST_API_USER_URL,
  GITEA_API_V1_PREFIX,
  GITLAB_API_V4_PREFIX,
} from './git-rest-api-urls';

export const GIT_OAUTH_FIXED = {
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    accessToken: 'https://github.com/login/oauth/access_token',
    apiUser: GITHUB_REST_API_USER_URL,
  },
  gitee: {
    authorize: 'https://gitee.com/oauth/authorize',
    token: 'https://gitee.com/oauth/token',
  },
} as const;

export const GITLAB_OAUTH_PATHS = {
  authorize: '/oauth/authorize',
  token: '/oauth/token',
  apiV4User: `${GITLAB_API_V4_PREFIX}/user`,
} as const;

export const GITEA_OAUTH_PATHS = {
  authorize: '/login/oauth/authorize',
  accessToken: '/login/oauth/access_token',
  apiV1User: `${GITEA_API_V1_PREFIX}/user`,
} as const;

export { giteeApiV5UserUrl, withNormalizedGitBase } from './git-rest-api-urls';
