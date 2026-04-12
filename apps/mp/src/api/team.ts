import { request } from './http';

export interface TeamMember {
  userId: string;
  role: string;
  user: { name: string; email: string };
}

export async function listMembers(orgSlug: string) {
  return request<TeamMember[]>({ url: `/orgs/${orgSlug}/members` });
}

export async function inviteMember(orgSlug: string, payload: { email: string; role: string }) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/members/invite`,
    method: 'POST',
    data: payload,
  });
}

export async function removeMember(orgSlug: string, userId: string) {
  return request<unknown>({ url: `/orgs/${orgSlug}/members/${userId}`, method: 'DELETE' });
}
