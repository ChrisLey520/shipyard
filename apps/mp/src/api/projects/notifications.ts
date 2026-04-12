import type { NotificationChannel, NotificationEvent } from '@shipyard/shared';
import { request } from '../http';

export interface ProjectNotificationRow {
  id: string;
  projectId: string;
  channel: NotificationChannel | string;
  events: NotificationEvent[] | string[];
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectNotificationPayload {
  channel: NotificationChannel;
  events: NotificationEvent[];
  config: Record<string, unknown>;
  enabled?: boolean;
}

export type UpdateProjectNotificationPayload = Partial<CreateProjectNotificationPayload>;

export async function listProjectNotifications(orgSlug: string, projectSlug: string) {
  return request<ProjectNotificationRow[]>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/notifications`,
  });
}

export async function createProjectNotification(
  orgSlug: string,
  projectSlug: string,
  payload: CreateProjectNotificationPayload,
) {
  return request<ProjectNotificationRow>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/notifications`,
    method: 'POST',
    data: payload as unknown as Record<string, unknown>,
  });
}

export async function updateProjectNotification(
  orgSlug: string,
  projectSlug: string,
  notificationId: string,
  payload: UpdateProjectNotificationPayload,
) {
  return request<ProjectNotificationRow>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/notifications/${notificationId}`,
    method: 'PATCH',
    data: payload as unknown as Record<string, unknown>,
  });
}

export async function deleteProjectNotification(
  orgSlug: string,
  projectSlug: string,
  notificationId: string,
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/projects/${projectSlug}/notifications/${notificationId}`,
    method: 'DELETE',
  });
}
