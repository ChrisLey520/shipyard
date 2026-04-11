import { http } from '../client';
import type { NotificationChannel, NotificationEvent } from '@shipyard/shared';

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
  return http
    .get<ProjectNotificationRow[]>(`/orgs/${orgSlug}/projects/${projectSlug}/notifications`)
    .then((r) => r.data);
}

export async function createProjectNotification(
  orgSlug: string,
  projectSlug: string,
  payload: CreateProjectNotificationPayload,
) {
  return http
    .post<ProjectNotificationRow>(`/orgs/${orgSlug}/projects/${projectSlug}/notifications`, payload)
    .then((r) => r.data);
}

export async function updateProjectNotification(
  orgSlug: string,
  projectSlug: string,
  notificationId: string,
  payload: UpdateProjectNotificationPayload,
) {
  return http
    .patch<ProjectNotificationRow>(
      `/orgs/${orgSlug}/projects/${projectSlug}/notifications/${notificationId}`,
      payload,
    )
    .then((r) => r.data);
}

export async function deleteProjectNotification(
  orgSlug: string,
  projectSlug: string,
  notificationId: string,
) {
  await http.delete(`/orgs/${orgSlug}/projects/${projectSlug}/notifications/${notificationId}`);
}
