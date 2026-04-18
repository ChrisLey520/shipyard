import { useQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { getProject } from '@/api/projects';
import { mapProjectDetailDtoToView } from '@/api/projects/mappers';

/** 项目详情：与列表 query 分离，变更后请同时 invalidate list + detail */
export function useProjectDetailQuery(
  orgSlug: MaybeRefOrGetter<string>,
  projectSlug: MaybeRefOrGetter<string>,
) {
  const org = computed(() => toValue(orgSlug));
  const slug = computed(() => toValue(projectSlug));

  return useQuery({
    queryKey: computed(() => ['projects', 'detail', org.value, slug.value] as const),
    queryFn: async () => {
      const raw = await getProject(org.value, slug.value);
      return mapProjectDetailDtoToView(raw);
    },
    enabled: computed(() => Boolean(org.value && slug.value)),
  });
}
