/**
 * Git 托管方展示与默认地址约定，与 GitProvider 枚举对齐。
 */

import { GitProvider } from './enums';

const LABEL_BY_PROVIDER: Record<GitProvider, string> = {
  [GitProvider.GITHUB]: 'GitHub',
  [GitProvider.GITLAB]: 'GitLab',
  [GitProvider.GITEE]: 'Gitee',
  [GitProvider.GITEA]: 'Gitea',
};

const WELL_KNOWN_BASE: Partial<Record<GitProvider, string>> = {
  [GitProvider.GITHUB]: 'https://github.com',
  [GitProvider.GITLAB]: 'https://gitlab.com',
  [GitProvider.GITEE]: 'https://gitee.com',
};

/** 新建 GitLab 连接时常用的占位默认 */
export const DEFAULT_GITLAB_BASE_URL = 'https://gitlab.com';

/** 公有云默认实例根 URL（Gitea 无统一值则 undefined） */
export function wellKnownGitProviderBaseUrl(provider: GitProvider): string | undefined {
  return WELL_KNOWN_BASE[provider];
}

/** Naive UI n-select（可变数组以兼容 Naive 选项类型） */
export const GIT_PROVIDER_SELECT_OPTIONS: Array<{ label: string; value: GitProvider }> = [
  { label: LABEL_BY_PROVIDER[GitProvider.GITHUB], value: GitProvider.GITHUB },
  { label: LABEL_BY_PROVIDER[GitProvider.GITLAB], value: GitProvider.GITLAB },
  { label: LABEL_BY_PROVIDER[GitProvider.GITEE], value: GitProvider.GITEE },
  { label: LABEL_BY_PROVIDER[GitProvider.GITEA], value: GitProvider.GITEA },
];

/** Naive UI n-dropdown（OAuth） */
export const GIT_PROVIDER_OAUTH_DROPDOWN_OPTIONS: Array<{ label: string; key: string }> = [
  { label: 'GitHub OAuth', key: GitProvider.GITHUB },
  { label: 'GitLab OAuth', key: GitProvider.GITLAB },
  { label: 'Gitee OAuth', key: GitProvider.GITEE },
  { label: 'Gitea OAuth', key: GitProvider.GITEA },
];

const PROVIDER_VALUES = new Set<string>(Object.values(GitProvider));

export function isGitProviderString(value: string): value is GitProvider {
  return PROVIDER_VALUES.has(value);
}

export function gitProviderLabel(provider: string): string {
  if (isGitProviderString(provider)) return LABEL_BY_PROVIDER[provider];
  return provider;
}

/** GitLab / Gitea 需填写实例 baseUrl */
export function gitProviderRequiresBaseUrl(provider: string): boolean {
  return provider === GitProvider.GITLAB || provider === GitProvider.GITEA;
}

/** 列表展示：优先账户 baseUrl，否则知名默认，否则 "-" */
export function displayGitProviderBaseUrl(
  provider: string,
  baseUrl: string | null | undefined,
): string {
  const trimmed = baseUrl?.trim();
  if (trimmed) return trimmed;
  if (isGitProviderString(provider)) {
    const w = WELL_KNOWN_BASE[provider];
    if (w) return w;
  }
  return '-';
}
