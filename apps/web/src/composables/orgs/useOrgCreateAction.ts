import { createOrg } from '@/api/orgs';

/** 组织列表页：创建组织（页面不直接 import api/orgs） */
export function useOrgCreateAction() {
  return {
    createOrg: (payload: { name: string; slug: string }) => createOrg(payload),
  };
}
