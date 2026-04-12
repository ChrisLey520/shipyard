import { ref } from 'vue';
import { useOrgStore } from '@/stores/org';

/** 从页面 query 解析 orgSlug 并同步到 org store */
export function useOrgPageContext() {
  const orgStore = useOrgStore();
  const orgSlug = ref('');

  function initOrgFromQuery(q: Record<string, string | undefined>) {
    const s = q.orgSlug?.trim();
    if (!s) {
      uni.showToast({ title: '缺少组织参数', icon: 'none' });
      setTimeout(() => uni.navigateBack(), 500);
      return false;
    }
    orgStore.setCurrentOrg(s);
    orgSlug.value = s;
    return true;
  }

  return { orgSlug, initOrgFromQuery };
}
