import { request } from '@/api/http';

export interface FeatureFlagRow {
  id: string;
  key: string;
  enabled: boolean;
  valueJson: unknown;
  projectId: string | null;
  environmentId: string | null;
  updatedAt: string;
}

export async function listFeatureFlags(
  orgSlug: string,
  projectSlug?: string | null,
  environmentName?: string | null,
) {
  const params = new URLSearchParams();
  if (projectSlug) params.set('projectSlug', projectSlug);
  if (environmentName) params.set('environmentName', environmentName);
  const q = params.toString();
  return request<FeatureFlagRow[]>({ url: `/orgs/${orgSlug}/feature-flags${q ? `?${q}` : ''}` });
}

export async function createFeatureFlag(
  orgSlug: string,
  body: {
    key: string;
    enabled?: boolean;
    valueJson?: unknown;
    projectSlug?: string | null;
    environmentName?: string | null;
  },
) {
  return request<FeatureFlagRow>({
    url: `/orgs/${orgSlug}/feature-flags`,
    method: 'POST',
    data: body,
  });
}

export async function updateFeatureFlag(
  orgSlug: string,
  flagId: string,
  body: Partial<{ key: string; enabled: boolean; valueJson: unknown | null }>,
) {
  return request<FeatureFlagRow>({
    url: `/orgs/${orgSlug}/feature-flags/${flagId}`,
    method: 'PATCH',
    data: body,
  });
}

export async function deleteFeatureFlag(orgSlug: string, flagId: string) {
  return request<unknown>({ url: `/orgs/${orgSlug}/feature-flags/${flagId}`, method: 'DELETE' });
}
