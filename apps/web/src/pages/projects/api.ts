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
    updatedAt: string;
  };
  _count?: { deployments: number; environments: number };
  environments: {
    id: string;
    name: string;
    triggerBranch: string;
    protected: boolean;
    deployPath: string;
    domain: string | null;
    healthCheckUrl: string | null;
    server: { id: string; name: string; host: string };
  }[];
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

