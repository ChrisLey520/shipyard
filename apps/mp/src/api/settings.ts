import { request } from './http';

export interface OrgSettings {
  name: string;
  slug: string;
  buildConcurrency: number;
  artifactRetention: number;
}

export async function getOrg(orgSlug: string) {
  return request<OrgSettings>({ url: `/orgs/${orgSlug}` });
}

export async function updateOrg(orgSlug: string, payload: Partial<OrgSettings>) {
  return request<unknown>({ url: `/orgs/${orgSlug}`, method: 'PATCH', data: payload });
}
