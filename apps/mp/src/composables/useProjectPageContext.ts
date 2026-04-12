import { ref } from 'vue';
import { useOrgPageContext } from '@/composables/useOrgPageContext';

export function useProjectPageContext() {
  const { orgSlug, initOrgFromQuery } = useOrgPageContext();
  const projectSlug = ref('');

  function initProjectFromQuery(q: Record<string, string | undefined>) {
    if (!initOrgFromQuery(q)) return false;
    const p = q.projectSlug?.trim();
    if (!p) {
      uni.showToast({ title: '缺少项目参数', icon: 'none' });
      setTimeout(() => uni.navigateBack(), 500);
      return false;
    }
    projectSlug.value = p;
    return true;
  }

  return { orgSlug, projectSlug, initProjectFromQuery };
}
