import { useQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { listDeployments } from '@/api/projects';
import { mapDeploymentListDto } from '@/api/projects/mappers';

/**
 * 部署历史列表（与详情接口分离，避免与 getProject 重复请求同一资源）。
 * 若未来后端在详情中内联 deployments，可在此合并策略或改为从 detail 派生。
 */
export function useProjectDeploymentsQuery(
  orgSlug: MaybeRefOrGetter<string>,
  projectSlug: MaybeRefOrGetter<string>,
) {
  const org = computed(() => toValue(orgSlug));
  const slug = computed(() => toValue(projectSlug));

  return useQuery({
    queryKey: computed(() => ['projects', 'deployments', org.value, slug.value] as const),
    queryFn: async () => {
      const raw = await listDeployments(org.value, slug.value);
      return mapDeploymentListDto(raw);
    },
    enabled: computed(() => Boolean(org.value && slug.value)),
  });
}
