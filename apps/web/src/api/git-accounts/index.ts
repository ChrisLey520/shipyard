import { http } from '../client';

export interface GitAccountItem {
  id: string;
  name: string;
  gitProvider: string;
  baseUrl: string | null;
  gitUsername: string | null;
  authType?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listGitAccounts(orgSlug: string) {
  return http.get<GitAccountItem[]>(`/orgs/${orgSlug}/git-accounts`).then((r) => r.data);
}

export async function createGitAccount(
  orgSlug: string,
  payload: { name: string; gitProvider: string; baseUrl?: string; accessToken: string; gitUsername?: string },
) {
  return http.post<GitAccountItem>(`/orgs/${orgSlug}/git-accounts`, payload).then((r) => r.data);
}

export async function updateGitAccount(
  orgSlug: string,
  gitAccountId: string,
  payload: { name?: string; baseUrl?: string | null; accessToken?: string; gitUsername?: string | null },
) {
  return http.patch<GitAccountItem>(`/orgs/${orgSlug}/git-accounts/${gitAccountId}`, payload).then((r) => r.data);
}

export async function deleteGitAccount(orgSlug: string, gitAccountId: string) {
  return http.delete(`/orgs/${orgSlug}/git-accounts/${gitAccountId}`).then((r) => r.data);
}

export async function listReposForGitAccount(orgSlug: string, gitAccountId: string) {
  return http
    .get<Array<{ fullName: string; private: boolean }>>(`/orgs/${orgSlug}/git-accounts/${gitAccountId}/repos`)
    .then((r) => r.data);
}

export async function startGitOAuth(orgSlug: string, provider: string): Promise<string> {
  const r = await http.get<{ url: string }>(`/orgs/${orgSlug}/git/oauth/${provider}/start`);
  return r.data.url;
}

