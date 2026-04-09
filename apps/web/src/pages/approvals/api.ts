import { http } from '../../api/client';

export interface ApprovalItem {
  id: string;
  deploymentId: string;
  status: string;
  deployment?: { branch: string; commitMessage: string; environment?: { name: string } };
  requestedBy?: { name: string };
  reviewedBy?: { name: string };
  createdAt: string;
}

export async function listApprovals(orgSlug: string) {
  return http.get<ApprovalItem[]>(`/orgs/${orgSlug}/approvals`).then((r) => r.data);
}

export async function reviewApproval(
  orgSlug: string,
  approvalId: string,
  payload: { decision: 'approved' | 'rejected'; comment?: string },
) {
  return http.post(`/orgs/${orgSlug}/approvals/${approvalId}/review`, payload).then((r) => r.data);
}

