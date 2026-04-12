import type { ServerOs } from '@shipyard/shared';
import { request } from './http';

export interface ServerItem {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  os: ServerOs;
  previewPortMin?: number | null;
  previewPortMax?: number | null;
}

export async function listServers(orgSlug: string) {
  return request<ServerItem[]>({ url: `/orgs/${orgSlug}/servers` });
}

export async function createServer(orgSlug: string, payload: Record<string, unknown>) {
  return request<unknown>({ url: `/orgs/${orgSlug}/servers`, method: 'POST', data: payload });
}

export async function updateServer(orgSlug: string, serverId: string, payload: Record<string, unknown>) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/servers/${serverId}`,
    method: 'PATCH',
    data: payload,
  });
}

export async function deleteServer(orgSlug: string, serverId: string) {
  return request<unknown>({ url: `/orgs/${orgSlug}/servers/${serverId}`, method: 'DELETE' });
}

export async function testServer(orgSlug: string, serverId: string) {
  return request<{ success: boolean; message: string }>({
    url: `/orgs/${orgSlug}/servers/${serverId}/test`,
    method: 'POST',
  });
}
