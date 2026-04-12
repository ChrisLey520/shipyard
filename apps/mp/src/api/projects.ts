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

export interface PipelineConfigShape {
  installCommand: string;
  buildCommand: string;
  lintCommand: string | null;
  testCommand: string | null;
  outputDir: string;
  nodeVersion: string;
  cacheEnabled: boolean;
  timeoutSeconds: number;
  ssrEntryPoint: string | null;
  previewHealthCheckPath: string | null;
  containerImageEnabled?: boolean;
  containerImageName?: string | null;
  updatedAt?: string;
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
  pipelineConfig: null | PipelineConfigShape;
  previewEnabled?: boolean;
  previewServerId?: string | null;
  previewBaseDomain?: string | null;
  previewServer?: { id: string; name: string; host: string; os: string } | null;
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

export type UpdateProjectPayload = {
  name?: string;
  frameworkType?: string;
  slug?: string;
  previewEnabled?: boolean;
  previewServerId?: string | null;
  previewBaseDomain?: string | null;
  notificationMessageTemplate?: string | null;
};

export type UpdatePipelineConfigPayload = Partial<{
  installCommand: string;
  buildCommand: string;
  lintCommand: string | null;
  testCommand: string | null;
  outputDir: string;
  nodeVersion: string;
  cacheEnabled: boolean;
  timeoutSeconds: number;
  ssrEntryPoint: string | null;
  previewHealthCheckPath: string | null;
  containerImageEnabled: boolean;
  containerImageName: string | null;
  containerRegistryAuth: { username?: string; password?: string } | null;
}>;

export interface ProjectBuildEnvVar {
  id: string;
  key: string;
  updatedAt: string;
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

export async function updateProject(
  orgSlug: string,
  projectSlug: string,
  payload: UpdateProjectPayload,
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}`,
    method: 'PATCH',
    data: payload,
  });
}

export async function updatePipelineConfig(
  orgSlug: string,
  projectSlug: string,
  payload: UpdatePipelineConfigPayload,
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/pipeline-config`,
    method: 'PATCH',
    data: payload,
  });
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

export async function listProjectBuildEnv(orgSlug: string, projectSlug: string) {
  return request<ProjectBuildEnvVar[]>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/build-env`,
  });
}

export async function upsertProjectBuildEnv(
  orgSlug: string,
  projectSlug: string,
  payload: { key: string; value: string },
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/build-env`,
    method: 'POST',
    data: payload,
  });
}

export async function deleteProjectBuildEnv(orgSlug: string, projectSlug: string, varId: string) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/build-env/${varId}`,
    method: 'DELETE',
  });
}
