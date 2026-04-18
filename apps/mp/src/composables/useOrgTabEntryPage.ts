import { useAuthStore } from '@/stores/auth';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import { reLaunchToLoginWithRedirect } from '@/utils/redirectLogin';

/**
 * 主包 Tab 页（首页 / 部署 / 协作 / 组织 / 我的）：与 dashboard 相同的 orgSlug 解析（switchTab 无 query，依赖 store）
 */
export function useOrgTabEntryPage(t: (key: string) => string) {
  const auth = useAuthStore();
  const { orgSlug, initOrgFromQuery, syncOrgSlugFromStore, resolveDefaultOrgSlugIfNeeded } =
    useOrgPageContext();

  function onShowEntry() {
    if (!auth.isAuthenticated) {
      reLaunchToLoginWithRedirect();
      return;
    }
    syncOrgSlugFromStore();
  }

  function onLoadEntry(q: Record<string, string | undefined>) {
    const resolved = initOrgFromQuery(q, {
      allowStoreFallback: true,
      deferEmptyOrgRedirect: true,
    });
    if (resolved) return;

    void (async () => {
      const outcome = await resolveDefaultOrgSlugIfNeeded();
      if (outcome === 'picked') return;
      const msg =
        outcome === 'error' ? t('dashboard.orgListFailed') : t('dashboard.noOrgsCreateFirst');
      uni.showToast({ title: msg, icon: 'none' });
      setTimeout(() => {
        uni.switchTab({ url: '/pages/orgs/list' });
      }, 500);
    })();
  }

  return { orgSlug, onShowEntry, onLoadEntry };
}
