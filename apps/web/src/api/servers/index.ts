import type { ServerOs } from '@shipyard/shared';
import { http } from '../client';

export interface ServerItem {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  os: ServerOs;
  previewPortMin?: number | null;
  previewPortMax?: number | null;
  createdAt?: string;
}

export async function listServers(orgSlug: string) {
  return http.get<ServerItem[]>(`/orgs/${orgSlug}/servers`).then((r) => r.data);
}

export async function createServer(orgSlug: string, payload: Record<string, unknown>) {
  return http.post(`/orgs/${orgSlug}/servers`, payload).then((r) => r.data);
}

export async function updateServer(orgSlug: string, serverId: string, payload: Record<string, unknown>) {
  return http.patch(`/orgs/${orgSlug}/servers/${serverId}`, payload).then((r) => r.data);
}

export async function deleteServer(orgSlug: string, serverId: string) {
  return http.delete(`/orgs/${orgSlug}/servers/${serverId}`).then((r) => r.data);
}

export async function testServer(orgSlug: string, serverId: string) {
  return http
    .post<{ success: boolean; message: string }>(`/orgs/${orgSlug}/servers/${serverId}/test`)
    .then((r) => r.data);
}

