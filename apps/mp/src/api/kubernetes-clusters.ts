import { request } from './http';

export interface KubernetesClusterRow {
  id: string;
  name: string;
  createdAt: string;
}

export async function listKubernetesClusters(orgSlug: string) {
  return request<KubernetesClusterRow[]>({ url: `/orgs/${orgSlug}/kubernetes-clusters` });
}

export async function createKubernetesCluster(orgSlug: string, body: { name: string; kubeconfig: string }) {
  return request<KubernetesClusterRow>({
    url: `/orgs/${orgSlug}/kubernetes-clusters`,
    method: 'POST',
    data: body,
  });
}

export async function deleteKubernetesCluster(orgSlug: string, clusterId: string) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/kubernetes-clusters/${clusterId}`,
    method: 'DELETE',
  });
}
