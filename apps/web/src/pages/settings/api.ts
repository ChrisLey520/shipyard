import { http } from '../../api/client';

export interface OrgSettings {
  name: string;
  buildConcurrency: number;
  artifactRetention: number;
}

export async function getOrg(orgSlug: string) {
  return http.get<OrgSettings>(`/orgs/${orgSlug}`).then((r) => r.data);
}

export async function updateOrg(orgSlug: string, payload: Partial<OrgSettings>) {
  return http.patch(`/orgs/${orgSlug}`, payload).then((r) => r.data);
}

