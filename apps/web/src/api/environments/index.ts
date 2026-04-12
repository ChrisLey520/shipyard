import { http } from '../client';

export interface Env {
  id: string;
  name: string;
  triggerBranch: string;
  deployPath: string;
  protected: boolean;
  domain: string | null;
  accessUrl?: string | null;
  healthCheckUrl?: string | null;
  server?: { id: string; name: string; host: string; os: string } | null;
  releaseConfig?: unknown;
  blueGreenActiveSlot?: number | null;
  environmentServers?: Array<{
    id: string;
    serverId: string;
    sortOrder: number;
    weight: number;
    server: { id: string; name: string; host: string; os: string };
  }>;
}

export interface EnvVar {
  id: string;
  key: string;
}

export async function listEnvironments(orgSlug: string, projectSlug: string) {
  return http.get<Env[]>(`/orgs/${orgSlug}/projects/${projectSlug}/environments`).then((r) => r.data);
}

export async function getEnvironmentAccessUrls(orgSlug: string, projectSlug: string) {
  return http
    .get<Record<string, string | null>>(
      `/orgs/${orgSlug}/projects/${projectSlug}/environments/access-urls`,
      { shipyard: { silent: true } },
    )
    .then((r) => r.data);
}

export async function createEnvironment(orgSlug: string, projectSlug: string, payload: Record<string, unknown>) {
  return http.post(`/orgs/${orgSlug}/projects/${projectSlug}/environments`, payload).then((r) => r.data);
}

export type UpdateEnvironmentPayload = Partial<{
  name: string;
  triggerBranch: string;
  serverId: string;
  deployPath: string;
  domain: string | null;
  healthCheckUrl: string | null;
  protected: boolean;
  releaseConfig: unknown;
  environmentTargets: Array<{ serverId: string; sortOrder?: number; weight?: number }>;
}>;

export async function updateEnvironment(
  orgSlug: string,
  projectSlug: string,
  envId: string,
  payload: UpdateEnvironmentPayload,
) {
  return http
    .patch(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}`, payload)
    .then((r) => r.data);
}

export async function deleteEnvironment(orgSlug: string, projectSlug: string, envId: string) {
  return http.delete(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}`).then((r) => r.data);
}

export async function listServersForOrg(orgSlug: string) {
  return http.get<Array<{ id: string; name: string; os: string }>>(`/orgs/${orgSlug}/servers`).then((r) => r.data);
}

export async function listProjectGithubBranches(orgSlug: string, projectSlug: string) {
  return http
    .get<string[]>(`/orgs/${orgSlug}/projects/${projectSlug}/git/github/branches`)
    .then((r) => r.data);
}

export async function listProjectBranches(orgSlug: string, projectSlug: string) {
  return http
    .get<string[]>(`/orgs/${orgSlug}/projects/${projectSlug}/git/branches`)
    .then((r) => r.data);
}

export async function listEnvVars(orgSlug: string, projectSlug: string, envId: string) {
  return http
    .get<EnvVar[]>(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}/variables`)
    .then((r) => r.data);
}

export async function upsertEnvVar(
  orgSlug: string,
  projectSlug: string,
  envId: string,
  payload: { key: string; value: string },
) {
  return http
    .post(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}/variables`, payload)
    .then((r) => r.data);
}

export async function deleteEnvVar(orgSlug: string, projectSlug: string, envId: string, varId: string) {
  return http
    .delete(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}/variables/${varId}`)
    .then((r) => r.data);
}

