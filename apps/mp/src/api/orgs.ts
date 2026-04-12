import { request } from './http';

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  buildConcurrency: number;
  artifactRetention: number;
}

export async function listOrgs() {
  return request<OrgRow[]>({ url: '/orgs' });
}

export async function createOrg(payload: { name: string; slug: string }) {
  return request<unknown>({ url: '/orgs', method: 'POST', data: payload });
}

export async function getOrgBySlug(orgSlug: string) {
  return request<OrgRow>({ url: `/orgs/${orgSlug}` });
}
