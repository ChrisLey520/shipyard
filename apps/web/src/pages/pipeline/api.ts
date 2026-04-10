import { http } from '../../api/client';

/** 部署成功后由 worker 写入，用于 macOS 无 Nginx 时的 PM2 静态访问 */
export interface ShipyardDeployAccessMeta {
  staticPort: number;
  staticHost: string;
}

export interface DeploymentDetail {
  id: string;
  branch: string;
  commitMessage: string;
  status: string;
  trigger: string;
  durationMs: number | null;
  /** 含 shipyardAccess 时表示本次部署在目标机启动了 PM2 静态服务 */
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

