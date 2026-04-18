import type { AxiosRequestConfig } from 'axios';
import { http } from '../client';

export interface KubernetesClusterRow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export async function listKubernetesClusters(orgSlug: string, config?: AxiosRequestConfig) {
  return http
    .get<KubernetesClusterRow[]>(`/orgs/${orgSlug}/kubernetes-clusters`, config)
    .then((r) => r.data);
}

export async function createKubernetesCluster(
  orgSlug: string,
  body: { name: string; kubeconfig: string },
) {
  return http.post<KubernetesClusterRow>(`/orgs/${orgSlug}/kubernetes-clusters`, body).then((r) => r.data);
}

export async function deleteKubernetesCluster(orgSlug: string, clusterId: string) {
  return http.delete(`/orgs/${orgSlug}/kubernetes-clusters/${clusterId}`).then((r) => r.data);
}
