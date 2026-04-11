import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import {
  createGitAccount,
  deleteGitAccount,
  listGitAccounts,
  listReposForGitAccount,
  startGitOAuth,
  updateGitAccount,
} from '@/api/git-accounts';

export type { GitAccountItem } from '@/api/git-accounts';

/** Git 账户页：列表、OAuth、PAT、连通测试、删除 */
export function useOrgGitAccountsActions(orgSlug: MaybeRefOrGetter<string>) {
  const org = computed(() => toValue(orgSlug));

  return {
    listGitAccounts: () => listGitAccounts(org.value),

    createGitAccount: (payload: Parameters<typeof createGitAccount>[1]) =>
      createGitAccount(org.value, payload),

    updateGitAccount: (gitAccountId: string, payload: Parameters<typeof updateGitAccount>[2]) =>
      updateGitAccount(org.value, gitAccountId, payload),

    deleteGitAccount: (gitAccountId: string) => deleteGitAccount(org.value, gitAccountId),

    listReposForGitAccount: (gitAccountId: string) =>
      listReposForGitAccount(org.value, gitAccountId),

    startGitOAuth: (provider: string) => startGitOAuth(org.value, provider),
  };
}
