import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { getDeploymentDetail, getDeploymentLogs } from '@/api/pipeline';
import { retryDeployment as retryDeploymentApi } from '@/api/projects';

export type { DeploymentDetail, DeploymentLogLine, ShipyardDeployAccessMeta } from '@/api/pipeline';

/** 部署详情页：详情、日志、重试（projects 写路径由 composable 收口） */
export function useDeploymentDetailActions(
  orgSlug: MaybeRefOrGetter<string>,
  projectSlug: MaybeRefOrGetter<string>,
  deploymentId: MaybeRefOrGetter<string>,
) {
  const org = computed(() => toValue(orgSlug));
  const project = computed(() => toValue(projectSlug));
  const deployId = computed(() => toValue(deploymentId));

  return {
    getDeploymentDetail: () =>
      getDeploymentDetail(org.value, project.value, deployId.value),

    getDeploymentLogs: () =>
      getDeploymentLogs(org.value, project.value, deployId.value),

    retryDeployment: () => retryDeploymentApi(org.value, project.value, deployId.value),
  };
}
