import { http } from '../client';

export interface FeatureFlagRow {
  id: string;
  key: string;
  enabled: boolean;
  valueJson: unknown;
  projectId: string | null;
  updatedAt: string;
}

export async function listFeatureFlags(orgSlug: string, projectSlug?: string | null) {
  const q = projectSlug ? `?projectSlug=${encodeURIComponent(projectSlug)}` : '';
  return http.get<FeatureFlagRow[]>(`/orgs/${orgSlug}/feature-flags${q}`).then((r) => r.data);
}

export async function createFeatureFlag(
  orgSlug: string,
  body: {
    key: string;
    enabled?: boolean;
    valueJson?: unknown;
    projectSlug?: string | null;
  },
) {
  return http.post<FeatureFlagRow>(`/orgs/${orgSlug}/feature-flags`, body).then((r) => r.data);
}

export async function updateFeatureFlag(
  orgSlug: string,
  flagId: string,
  body: Partial<{ key: string; enabled: boolean; valueJson: unknown | null }>,
) {
  return http.patch<FeatureFlagRow>(`/orgs/${orgSlug}/feature-flags/${flagId}`, body).then((r) => r.data);
}

export async function deleteFeatureFlag(orgSlug: string, flagId: string) {
  return http.delete(`/orgs/${orgSlug}/feature-flags/${flagId}`).then((r) => r.data);
}
