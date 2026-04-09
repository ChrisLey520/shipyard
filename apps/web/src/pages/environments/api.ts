import { http } from '../../api/client';

export interface Env {
  id: string;
  name: string;
  triggerBranch: string;
  deployPath: string;
  protected: boolean;
  domain: string | null;
}

export interface EnvVar {
  id: string;
  key: string;
}

export async function listEnvironments(orgSlug: string, projectSlug: string) {
  return http.get<Env[]>(`/orgs/${orgSlug}/projects/${projectSlug}/environments`).then((r) => r.data);
}

export async function createEnvironment(orgSlug: string, projectSlug: string, payload: Record<string, unknown>) {
  return http.post(`/orgs/${orgSlug}/projects/${projectSlug}/environments`, payload).then((r) => r.data);
}

export async function deleteEnvironment(orgSlug: string, projectSlug: string, envId: string) {
  return http.delete(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}`).then((r) => r.data);
}

export async function listServersForOrg(orgSlug: string) {
  return http.get<{ id: string; name: string }[]>(`/orgs/${orgSlug}/servers`).then((r) => r.data);
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

