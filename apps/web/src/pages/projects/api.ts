import { http } from '../../api/client';

export interface ProjectListItem {
  id: string;
  name: string;
  slug: string;
  repoFullName: string;
  frameworkType: string;
  environments: { id: string }[];
  _count: { deployments: number };
}

export interface ProjectDetail {
  name: string;
  repoFullName: string;
  environments: { id: string; name: string; triggerBranch: string; protected: boolean }[];
}

export interface DeploymentListItem {
  id: string;
  branch: string;
  commitMessage: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  environment?: { name: string };
  artifactId: string | null;
}

export async function listProjects(orgSlug: string) {
  return http.get<ProjectListItem[]>(`/orgs/${orgSlug}/projects`).then((r) => r.data);
}

export async function createProject(orgSlug: string, payload: Record<string, unknown>) {
  return http.post(`/orgs/${orgSlug}/projects`, payload).then((r) => r.data);
}

export async function getProject(orgSlug: string, projectSlug: string) {
  return http.get<ProjectDetail>(`/orgs/${orgSlug}/projects/${projectSlug}`).then((r) => r.data);
}

export async function listDeployments(orgSlug: string, projectSlug: string) {
  return http
    .get<DeploymentListItem[]>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments`)
    .then((r) => r.data);
}

export async function triggerDeploy(orgSlug: string, projectSlug: string, payload: { environmentId: string }) {
  return http.post(`/orgs/${orgSlug}/projects/${projectSlug}/deploy`, payload).then((r) => r.data);
}

export async function rollbackDeployment(orgSlug: string, projectSlug: string, deploymentId: string) {
  return http
    .post(`/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}/rollback`)
    .then((r) => r.data);
}

