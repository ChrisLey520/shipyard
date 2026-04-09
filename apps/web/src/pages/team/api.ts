import { http } from '../../api/client';

export interface TeamMember {
  userId: string;
  role: string;
  user: { name: string; email: string };
}

export async function listMembers(orgSlug: string) {
  return http.get<TeamMember[]>(`/orgs/${orgSlug}/members`).then((r) => r.data);
}

export async function inviteMember(orgSlug: string, payload: { email: string; role: string }) {
  return http.post(`/orgs/${orgSlug}/members/invite`, payload).then((r) => r.data);
}

export async function removeMember(orgSlug: string, userId: string) {
  return http.delete(`/orgs/${orgSlug}/members/${userId}`).then((r) => r.data);
}

