import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { getOrg, updateOrg, type OrgSettings } from '@/api/settings';

/** 组织设置：读取与更新（页面不直接 import api/settings） */
export function useOrgSettings(orgSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  const slug = computed(() => toValue(orgSlug));

  const orgQuery = useQuery({
    queryKey: computed(() => ['orgs', 'settings', slug.value] as const),
    queryFn: () => getOrg(slug.value),
    enabled: computed(() => Boolean(slug.value)),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<OrgSettings>) => updateOrg(slug.value, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orgs', 'settings', slug.value] });
    },
  });

  return {
    orgQuery,
    org: computed(() => orgQuery.data.value ?? null),
    loadingOrg: computed(() => orgQuery.isPending.value || orgQuery.isFetching.value),
    saveOrg: (payload: Partial<OrgSettings>) => saveMutation.mutateAsync(payload),
    saving: computed(() => saveMutation.isPending.value),
  };
}
