import { request } from './http';

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
  return request<ApprovalItem[]>({ url: `/orgs/${orgSlug}/approvals` });
}

export async function reviewApproval(
  orgSlug: string,
  approvalId: string,
  payload: { decision: 'approved' | 'rejected'; comment?: string },
) {
  return request<unknown>({
    url: `/orgs/${orgSlug}/approvals/${approvalId}/review`,
    method: 'POST',
    data: payload,
  });
}
