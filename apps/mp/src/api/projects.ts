import { request } from './http';

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
  id: string;
  name: string;
  slug: string;
  repoFullName: string;
  frameworkType: string;
  createdAt: string;
  updatedAt: string;
  gitConnection: null | {
    id: string;
    gitProvider: string;
    gitUsername: string | null;
    createdAt: string;
    updatedAt: string;
  };
  pipelineConfig: null | Record<string, unknown>;
  previewEnabled?: boolean;
  previewServerId?: string | null;
  previewBaseDomain?: string | null;
  notificationMessageTemplate?: string | null;
  environments: Array<{
    id: string;
    name: string;
    triggerBranch: string;
    protected: boolean;
    deployPath: string;
    domain: string | null;
    accessUrl?: string | null;
    healthCheckUrl: string | null;
    server: { id: string; name: string; host: string; os: string };
  }>;
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
  return request<ProjectListItem[]>({ url: `/orgs/${orgSlug}/projects` });
}

export async function createProject(orgSlug: string, payload: Record<string, unknown>) {
  return request<unknown>({ url: `/orgs/${orgSlug}/projects`, method: 'POST', data: payload });
}

export async function getProject(orgSlug: string, projectSlug: string) {
  return request<ProjectDetail>({ url: `/orgs/${orgSlug}/projects/${projectSlug}` });
}

export async function deleteProject(orgSlug: string, projectSlug: string) {
  return request<unknown>({ url: `/orgs/${orgSlug}/projects/${projectSlug}`, method: 'DELETE' });
}

export async function listDeployments(orgSlug: string, projectSlug: string) {
  return request<DeploymentListItem[]>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/deployments`,
  });
}

export async function triggerDeploy(orgSlug: string, projectSlug: string, payload: { environmentId: string }) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/deploy`,
    method: 'POST',
    data: payload,
  });
}

export async function retryDeployment(orgSlug: string, projectSlug: string, deploymentId: string) {
  return request<{ id: string }>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}/retry`,
    method: 'POST',
  });
}
