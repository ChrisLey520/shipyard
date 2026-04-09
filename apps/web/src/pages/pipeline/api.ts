import { http } from '../../api/client';

export interface DeploymentDetail {
  id: string;
  branch: string;
  commitMessage: string;
  status: string;
  trigger: string;
  durationMs: number | null;
  environment?: { name: string };
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
  return http
    .get<DeploymentDetail>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}`)
    .then((r) => r.data);
}

export async function getDeploymentLogs(
  orgSlug: string,
  projectSlug: string,
  deploymentId: string,
) {
  return http
    .get<DeploymentLogLine[]>(
      `/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}/logs`,
    )
    .then((r) => r.data);
}

