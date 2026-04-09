export enum DeploymentStatus {
  PENDING_APPROVAL = 'pending_approval',
  QUEUED = 'queued',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}

export enum DeploymentTrigger {
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
  ROLLBACK = 'rollback',
}

export enum GitProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  GITEE = 'gitee',
  GITEA = 'gitea',
}

export enum FrameworkType {
  STATIC = 'static',
  SSR = 'ssr',
}

export enum OrgRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export enum NotificationChannel {
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  FEISHU = 'feishu',
  DINGTALK = 'dingtalk',
  SLACK = 'slack',
}

export enum NotificationEvent {
  BUILD_SUCCESS = 'build_success',
  BUILD_FAILED = 'build_failed',
  DEPLOY_SUCCESS = 'deploy_success',
  DEPLOY_FAILED = 'deploy_failed',
  APPROVAL_PENDING = 'approval_pending',
  APPROVAL_APPROVED = 'approval_approved',
  APPROVAL_REJECTED = 'approval_rejected',
}
