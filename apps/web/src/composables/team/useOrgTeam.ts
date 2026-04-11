import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { inviteMember, listMembers, removeMember, type TeamMember } from '@/api/team';

export type { TeamMember };

/** 团队成员列表 + 邀请/移除（页面不直接 import api/team） */
export function useOrgTeam(orgSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  const slug = computed(() => toValue(orgSlug));

  const membersQuery = useQuery({
    queryKey: computed(() => ['team', 'members', slug.value] as const),
    queryFn: () => listMembers(slug.value),
    enabled: computed(() => Boolean(slug.value)),
  });

  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; role: string }) => inviteMember(slug.value, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team', 'members', slug.value] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(slug.value, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team', 'members', slug.value] });
    },
  });

  const members = computed<TeamMember[]>(() => membersQuery.data.value ?? []);

  return {
    membersQuery,
    members,
    loading: computed(() => membersQuery.isPending.value || membersQuery.isFetching.value),
    inviteMember: (payload: { email: string; role: string }) => inviteMutation.mutateAsync(payload),
    inviting: computed(() => inviteMutation.isPending.value),
    removeMember: (userId: string) => removeMutation.mutateAsync(userId),
  };
}
