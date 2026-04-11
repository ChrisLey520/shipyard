import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import {
  createGitAccount,
  createProject,
  listGitAccounts,
  listReposForGitAccount,
  type GitAccountListItem,
} from '@/api/projects';

export type { GitAccountListItem };

/** 新建项目向导：Git 账户、仓库列表、创建项目（页面不直接 import api） */
export function useProjectCreationFlow(orgSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  const org = computed(() => toValue(orgSlug));

  const createProjectMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createProject(org.value, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', 'list', org.value] });
    },
  });

  async function loadGitAccounts(): Promise<GitAccountListItem[]> {
    return listGitAccounts(org.value);
  }

  async function loadReposForAccount(gitAccountId: string) {
    return listReposForGitAccount(org.value, gitAccountId);
  }

  async function addGitAccount(payload: Parameters<typeof createGitAccount>[1]) {
    return createGitAccount(org.value, payload);
  }

  return {
    creatingProject: computed(() => createProjectMutation.isPending.value),
    createProject: (payload: Record<string, unknown>) => createProjectMutation.mutateAsync(payload),
    loadGitAccounts,
    loadReposForAccount,
    addGitAccount,
  };
}
