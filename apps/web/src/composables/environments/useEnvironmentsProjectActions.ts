import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import {
  createEnvironment,
  deleteEnvironment,
  deleteEnvVar,
  listEnvironments,
  listEnvVars,
  listProjectBranches,
  listServersForOrg,
  updateEnvironment,
  upsertEnvVar,
  type UpdateEnvironmentPayload,
} from '@/api/environments';

export type { Env, EnvVar } from '@/api/environments';

/** 项目下环境列表、变量、弹窗内创建/编辑所需远端调用 */
export function useEnvironmentsProjectActions(
  orgSlug: MaybeRefOrGetter<string>,
  projectSlug: MaybeRefOrGetter<string>,
) {
  const org = computed(() => toValue(orgSlug));
  const project = computed(() => toValue(projectSlug));

  return {
    listEnvironments: () => listEnvironments(org.value, project.value),

    deleteEnvironment: (envId: string) => deleteEnvironment(org.value, project.value, envId),

    listEnvVars: (envId: string) => listEnvVars(org.value, project.value, envId),

    upsertEnvVar: (envId: string, payload: { key: string; value: string }) =>
      upsertEnvVar(org.value, project.value, envId, payload),

    deleteEnvVar: (envId: string, varId: string) =>
      deleteEnvVar(org.value, project.value, envId, varId),

    listServersForOrg: () => listServersForOrg(org.value),

    listProjectBranches: () => listProjectBranches(org.value, project.value),

    createEnvironment: (payload: Record<string, unknown>) =>
      createEnvironment(org.value, project.value, payload),

    updateEnvironment: (envId: string, payload: UpdateEnvironmentPayload) =>
      updateEnvironment(org.value, project.value, envId, payload),
  };
}
