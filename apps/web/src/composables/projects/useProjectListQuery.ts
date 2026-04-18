import { useQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { listProjects } from '@/api/projects';

/** 组织下项目列表（TanStack Query） */
export function useProjectListQuery(orgSlug: MaybeRefOrGetter<string>) {
  const slug = computed(() => toValue(orgSlug));
  return useQuery({
    queryKey: computed(() => ['projects', 'list', slug.value] as const),
    queryFn: () => listProjects(slug.value),
    enabled: computed(() => !!slug.value),
  });
}
