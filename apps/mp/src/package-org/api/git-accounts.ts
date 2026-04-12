import { request } from '@/api/http';

export interface GitAccountItem {
  id: string;
  name: string;
  gitProvider: string;
  baseUrl: string | null;
  gitUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listGitAccounts(orgSlug: string) {
  return request<GitAccountItem[]>({ url: `/orgs/${orgSlug}/git-accounts` });
}

export async function createGitAccount(
  orgSlug: string,
  payload: {
    name: string;
    gitProvider: string;
    baseUrl?: string;
    accessToken: string;
    gitUsername?: string;
  },
) {
  return request<GitAccountItem>({
    url: `/orgs/${orgSlug}/git-accounts`,
    method: 'POST',
    data: payload,
  });
}

export async function updateGitAccount(
  orgSlug: string,
  gitAccountId: string,
  payload: Record<string, unknown>,
) {
  return request<GitAccountItem>({
    url: `/orgs/${orgSlug}/git-accounts/${gitAccountId}`,
    method: 'PATCH',
    data: payload,
  });
}

export async function deleteGitAccount(orgSlug: string, gitAccountId: string) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/git-accounts/${gitAccountId}`,
    method: 'DELETE',
  });
}
