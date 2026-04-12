import { request } from '@/api/http';

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
}

export async function listEnvironments(orgSlug: string, projectSlug: string) {
  return request<Env[]>({ url: `/orgs/${orgSlug}/projects/${projectSlug}/environments` });
}

export async function createEnvironment(
  orgSlug: string,
  projectSlug: string,
  payload: Record<string, unknown>,
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/environments`,
    method: 'POST',
    data: payload,
  });
}

export async function updateEnvironment(
  orgSlug: string,
  projectSlug: string,
  envId: string,
  payload: Record<string, unknown>,
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}`,
    method: 'PATCH',
    data: payload,
  });
}

export async function deleteEnvironment(orgSlug: string, projectSlug: string, envId: string) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}`,
    method: 'DELETE',
  });
}

export interface EnvVar {
  id: string;
  key: string;
}

export async function listEnvVars(orgSlug: string, projectSlug: string, envId: string) {
  return request<EnvVar[]>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}/variables`,
  });
}

export async function upsertEnvVar(
  orgSlug: string,
  projectSlug: string,
  envId: string,
  body: { key: string; value: string },
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}/variables`,
    method: 'POST',
    data: body,
  });
}

export async function deleteEnvVar(orgSlug: string, projectSlug: string, envId: string, varId: string) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}/variables/${varId}`,
    method: 'DELETE',
  });
}

export async function listServersForOrg(orgSlug: string) {
  return request<Array<{ id: string; name: string; os: string }>>({ url: `/orgs/${orgSlug}/servers` });
}
