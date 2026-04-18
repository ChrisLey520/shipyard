import { request } from './http';

export interface DashboardProjectLite {
  id: string;
  slug: string;
}

export interface DashboardDeploymentLite {
  id: string;
  projectSlug?: string;
  branch: string;
  commitMessage?: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  environment?: { name: string };
}

export async function listProjectsForOrg(orgSlug: string) {
  return request<DashboardProjectLite[]>({ url: `/orgs/${orgSlug}/projects` });
}

export async function listDeploymentsForProject(orgSlug: string, projectSlug: string) {
  return request<DashboardDeploymentLite[]>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/deployments`,
  });
}
