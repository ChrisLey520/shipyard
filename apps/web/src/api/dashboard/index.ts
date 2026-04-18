import { http } from '../client';

export interface DashboardProjectLite {
  id: string;
  slug: string;
}

export interface DashboardDeploymentLite {
  id: string;
  /** Dashboard 合并多项目列表时由前端写入，用于跳转部署日志页 */
  projectSlug?: string;
  branch: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  environment?: { name: string };
}

export async function listProjectsForOrg(orgSlug: string) {
  return http.get<DashboardProjectLite[]>(`/orgs/${orgSlug}/projects`).then((r) => r.data);
}

export async function listDeploymentsForProject(orgSlug: string, projectSlug: string) {
  return http
    .get<DashboardDeploymentLite[]>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments`)
    .then((r) => r.data);
}

