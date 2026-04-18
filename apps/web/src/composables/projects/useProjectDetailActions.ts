import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { getEnvironmentAccessUrls } from '@/api/projects/environments';
import {
  bulkDeleteDeployments,
  clearDeployments,
  deleteDeployment as deleteDeploymentApi,
  deleteProject,
  deleteProjectBuildEnv,
  listProjectBuildEnv,
  retryDeployment,
  rollbackDeployment,
  triggerDeploy as triggerDeployApi,
  updatePipelineConfig,
  updateProject,
  upsertProjectBuildEnv,
  type UpdateProjectPayload,
} from '@/api/projects';

export type { DeploymentListItem, ProjectBuildEnvVar, ProjectDetail } from '@/api/projects';

/** 项目详情页：部署、构建变量、环境与访问 URL 等远端操作（页面不直接 import api） */
export function useProjectDetailActions(
  orgSlug: MaybeRefOrGetter<string>,
  projectSlug: MaybeRefOrGetter<string>,
) {
  const org = computed(() => toValue(orgSlug));
  const slug = computed(() => toValue(projectSlug));

  return {
    fetchEnvironmentAccessUrls: () => getEnvironmentAccessUrls(org.value, slug.value),

    deleteDeployment: (deploymentId: string) =>
      deleteDeploymentApi(org.value, slug.value, deploymentId),

    bulkDeleteDeployments: (ids: string[]) =>
      bulkDeleteDeployments(org.value, slug.value, ids),

    clearDeployments: () => clearDeployments(org.value, slug.value),

    triggerDeploy: (payload: { environmentId: string }) =>
      triggerDeployApi(org.value, slug.value, payload),

    rollbackDeployment: (deploymentId: string) =>
      rollbackDeployment(org.value, slug.value, deploymentId),

    retryDeployment: (deploymentId: string) =>
      retryDeployment(org.value, slug.value, deploymentId),

    updateProject: (currentSlug: string, body: UpdateProjectPayload) =>
      updateProject(org.value, currentSlug, body),

    updatePipelineConfig: (
      projectSlugForPath: string,
      body: Parameters<typeof updatePipelineConfig>[2],
    ) => updatePipelineConfig(org.value, projectSlugForPath, body),

    deleteProject: () => deleteProject(org.value, slug.value),

    listProjectBuildEnv: () => listProjectBuildEnv(org.value, slug.value),

    upsertProjectBuildEnv: (payload: { key: string; value: string }) =>
      upsertProjectBuildEnv(org.value, slug.value, payload),

    deleteProjectBuildEnv: (varId: string) =>
      deleteProjectBuildEnv(org.value, slug.value, varId),
  };
}
