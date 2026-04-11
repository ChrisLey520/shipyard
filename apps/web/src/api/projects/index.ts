import { http } from '../client';

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
  pipelineConfig: null | {
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
    updatedAt: string;
  };
  _count?: { deployments: number; environments: number };
  previewEnabled?: boolean;
  previewServerId?: string | null;
  previewBaseDomain?: string | null;
  previewServer?: { id: string; name: string; host: string; os: string } | null;
  environments: {
    id: string;
    name: string;
    triggerBranch: string;
    protected: boolean;
    deployPath: string;
    domain: string | null;
    accessUrl?: string | null;
    healthCheckUrl: string | null;
    server: { id: string; name: string; host: string; os: string };
  }[];
}

export type UpdateProjectPayload = {
  name?: string;
  frameworkType?: string;
  slug?: string;
  previewEnabled?: boolean;
  previewServerId?: string | null;
  previewBaseDomain?: string | null;
};

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

export async function listGithubReposByPat(pat: string) {
  return http.post<Array<{ fullName: string; private: boolean }>>(`/git/github/repos`, { pat }).then((r) => r.data);
}

export async function listGithubBranchesByPat(pat: string, repoFullName: string) {
  return http.post<string[]>(`/git/github/branches`, { pat, repoFullName }).then((r) => r.data);
}

export async function listGitlabReposByPat(pat: string, baseUrl?: string) {
  return http
    .post<Array<{ fullName: string; private: boolean }>>(`/git/gitlab/repos`, { pat, baseUrl })
    .then((r) => r.data);
}

export async function listGitlabBranchesByPat(pat: string, repoFullName: string, baseUrl?: string) {
  return http
    .post<string[]>(`/git/gitlab/branches`, { pat, repoFullName, baseUrl })
    .then((r) => r.data);
}

export async function listGiteeReposByPat(pat: string) {
  return http.post<Array<{ fullName: string; private: boolean }>>(`/git/gitee/repos`, { pat }).then((r) => r.data);
}

export async function listGiteeBranchesByPat(pat: string, repoFullName: string) {
  return http.post<string[]>(`/git/gitee/branches`, { pat, repoFullName }).then((r) => r.data);
}

export async function listGiteaReposByPat(pat: string, baseUrl: string) {
  return http
    .post<Array<{ fullName: string; private: boolean }>>(`/git/gitea/repos`, { pat, baseUrl })
    .then((r) => r.data);
}

export async function listGiteaBranchesByPat(pat: string, repoFullName: string, baseUrl: string) {
  return http
    .post<string[]>(`/git/gitea/branches`, { pat, repoFullName, baseUrl })
    .then((r) => r.data);
}

export interface GitAccountListItem {
  id: string;
  name: string;
  gitProvider: string;
  baseUrl: string | null;
  gitUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listGitAccounts(orgSlug: string) {
  return http.get<GitAccountListItem[]>(`/orgs/${orgSlug}/git-accounts`).then((r) => r.data);
}

export async function createGitAccount(
  orgSlug: string,
  payload: { name: string; gitProvider: string; baseUrl?: string; accessToken: string; gitUsername?: string },
) {
  return http.post(`/orgs/${orgSlug}/git-accounts`, payload).then((r) => r.data);
}

export async function listReposForGitAccount(orgSlug: string, gitAccountId: string) {
  return http
    .get<Array<{ fullName: string; private: boolean }>>(`/orgs/${orgSlug}/git-accounts/${gitAccountId}/repos`)
    .then((r) => r.data);
}

export async function getProject(orgSlug: string, projectSlug: string) {
  return http.get<ProjectDetail>(`/orgs/${orgSlug}/projects/${projectSlug}`).then((r) => r.data);
}

export async function updateProject(
  orgSlug: string,
  projectSlug: string,
  payload: UpdateProjectPayload,
) {
  return http.patch(`/orgs/${orgSlug}/projects/${projectSlug}`, payload).then((r) => r.data);
}

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
}>;

export async function updatePipelineConfig(
  orgSlug: string,
  projectSlug: string,
  payload: UpdatePipelineConfigPayload,
) {
  return http
    .patch(`/orgs/${orgSlug}/projects/${projectSlug}/pipeline-config`, payload)
    .then((r) => r.data);
}

export async function deleteProject(orgSlug: string, projectSlug: string) {
  return http.delete(`/orgs/${orgSlug}/projects/${projectSlug}`).then((r) => r.data);
}

export async function listDeployments(orgSlug: string, projectSlug: string) {
  return http
    .get<DeploymentListItem[]>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments`)
    .then((r) => r.data);
}

export async function deleteDeployment(orgSlug: string, projectSlug: string, deploymentId: string) {
  return http.delete(`/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}`).then((r) => r.data);
}

export async function bulkDeleteDeployments(orgSlug: string, projectSlug: string, ids: string[]) {
  return http
    .post<{ deleted: number }>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments/bulk-delete`, { ids })
    .then((r) => r.data);
}

export async function clearDeployments(orgSlug: string, projectSlug: string) {
  return http
    .delete<{ deleted: number }>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments`)
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

export async function retryDeployment(orgSlug: string, projectSlug: string, deploymentId: string) {
  return http
    .post<{ id: string }>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}/retry`)
    .then((r) => r.data);
}

export interface ProjectBuildEnvVar {
  id: string;
  key: string;
  updatedAt: string;
}

export async function listProjectBuildEnv(orgSlug: string, projectSlug: string) {
  return http.get<ProjectBuildEnvVar[]>(`/orgs/${orgSlug}/projects/${projectSlug}/build-env`).then((r) => r.data);
}

export async function upsertProjectBuildEnv(
  orgSlug: string,
  projectSlug: string,
  payload: { key: string; value: string },
) {
  return http.post(`/orgs/${orgSlug}/projects/${projectSlug}/build-env`, payload).then((r) => r.data);
}

export async function deleteProjectBuildEnv(orgSlug: string, projectSlug: string, varId: string) {
  return http.delete(`/orgs/${orgSlug}/projects/${projectSlug}/build-env/${varId}`).then((r) => r.data);
}

