import { ref } from 'vue';
import { useOrgStore } from '@/stores/org';
import { i18n } from '@/i18n';

export type InitOrgFromQueryOptions = {
  /**
   * Tab 工作台：无 query 时使用 store 当前组织（switchTab 无法带参数）。
   * 分包内页面勿开，仍要求 URL 带 orgSlug。
   */
  allowStoreFallback?: boolean;
  /**
   * 与 allowStoreFallback 联用：store 无当前组织时不立即 toast / 跳组织页，
   * 由调用方再尝试 resolveDefaultOrgSlugIfNeeded（拉列表选第一个）。
   */
  deferEmptyOrgRedirect?: boolean;
};

/** 从页面 query 解析 orgSlug 并同步到 org store */
export function useOrgPageContext() {
  const orgStore = useOrgStore();
  const orgSlug = ref('');

  function syncOrgSlugFromStore() {
    const s = orgStore.currentOrgSlug;
    if (s) orgSlug.value = s;
  }

  function initOrgFromQuery(q: Record<string, string | undefined>, opts?: InitOrgFromQueryOptions) {
    const s = q.orgSlug?.trim();
    if (s) {
      orgStore.setCurrentOrg(s);
      orgSlug.value = s;
      return true;
    }
    if (opts?.allowStoreFallback) {
      const from = orgStore.currentOrgSlug;
      if (from) {
        orgSlug.value = from;
        return true;
      }
      if (opts.deferEmptyOrgRedirect) {
        return false;
      }
      uni.showToast({ title: i18n.global.t('mpOrgPage.pickOrgFirst'), icon: 'none' });
      setTimeout(() => {
        uni.switchTab({ url: '/pages/orgs/list' });
      }, 500);
      return false;
    }
    uni.showToast({ title: i18n.global.t('mpOrgPage.missingOrgSlug'), icon: 'none' });
    setTimeout(() => uni.navigateBack(), 500);
    return false;
  }

  /** 无本地当前组织时拉取成员组织列表并选中第一个（用于首页冷启动） */
  async function resolveDefaultOrgSlugIfNeeded(): Promise<'picked' | 'empty' | 'error'> {
    try {
      await orgStore.fetchOrgs();
    } catch {
      return 'error';
    }
    const first = orgStore.orgs[0];
    if (!first) return 'empty';
    orgStore.setCurrentOrg(first.slug);
    orgSlug.value = first.slug;
    return 'picked';
  }

  return { orgSlug, initOrgFromQuery, syncOrgSlugFromStore, resolveDefaultOrgSlugIfNeeded };
}
