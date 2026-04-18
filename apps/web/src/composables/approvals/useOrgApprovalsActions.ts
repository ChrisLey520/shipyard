import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { listApprovals, reviewApproval, type ApprovalItem } from '@/api/approvals';

export type { ApprovalItem };

/** 审批中心：列表与审核 */
export function useOrgApprovalsActions(orgSlug: MaybeRefOrGetter<string>) {
  const org = computed(() => toValue(orgSlug));

  return {
    listApprovals: () => listApprovals(org.value),

    reviewApproval: (
      approvalId: string,
      payload: { decision: 'approved' | 'rejected'; comment?: string },
    ) => reviewApproval(org.value, approvalId, payload),
  };
}
