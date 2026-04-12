import { request } from './http';

export interface DeploymentDetail {
  id: string;
  branch: string;
  commitMessage: string;
  status: string;
  trigger: string;
  durationMs: number | null;
  configSnapshot?: Record<string, unknown> | null;
  environment?: {
    name: string;
    domain: string | null;
    healthCheckUrl: string | null;
    deployPath: string;
    server?: { id: string; name: string; host: string };
  };
  project?: { id: string; slug: string; name: string; frameworkType: string };
}

export interface DeploymentLogLine {
  content: string;
  seq: number;
}

export async function getDeploymentDetail(
  orgSlug: string,
  projectSlug: string,
  deploymentId: string,
) {
  return request<DeploymentDetail>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}`,
  });
}

export async function getDeploymentLogs(
  orgSlug: string,
  projectSlug: string,
  deploymentId: string,
) {
  return request<DeploymentLogLine[]>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}/logs`,
  });
}
