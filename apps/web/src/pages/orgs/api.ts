import { http } from '../../api/client';

export interface OrgGateOrg {
  id: string;
  name: string;
  slug: string;
  buildConcurrency: number;
  artifactRetention: number;
}

export async function createOrg(payload: { name: string; slug: string }) {
  return http.post('/orgs', payload).then((r) => r.data);
}

/** 用于校验当前 URL 中的组织是否可访问（存在且当前用户为成员） */
export async function getOrgBySlug(orgSlug: string) {
  return http.get<OrgGateOrg>(`/orgs/${orgSlug}`).then((r) => r.data);
}

