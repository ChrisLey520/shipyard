import { z } from 'zod';
import { FrameworkType, GitProvider, OrgRole } from './enums';

// 认证
export const RegisterDto = z.object({
  name: z.string().min(1).max(64),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordDto = z.object({
  email: z.string().email(),
});

export const ResetPasswordDto = z.object({
  token: z.string().uuid(),
  password: z.string().min(8).max(128),
});

// 组织
export const CreateOrgDto = z.object({
  name: z.string().min(1).max(64),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
});

export const UpdateOrgDto = z.object({
  name: z.string().min(1).max(64).optional(),
  buildConcurrency: z.number().int().min(1).max(20).optional(),
  artifactRetention: z.number().int().min(1).max(100).optional(),
});

// 成员邀请
export const InviteMemberDto = z.object({
  email: z.string().email(),
  role: z.enum([OrgRole.ADMIN, OrgRole.DEVELOPER, OrgRole.VIEWER]),
});

export const UpdateMemberRoleDto = z.object({
  role: z.enum([OrgRole.ADMIN, OrgRole.DEVELOPER, OrgRole.VIEWER]),
});

// 项目
export const CreateProjectDto = z.object({
  name: z.string().min(1).max(64),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  frameworkType: z.nativeEnum(FrameworkType),
  repoFullName: z.string().min(1),
  gitProvider: z.nativeEnum(GitProvider),
  accessToken: z.string().min(1),
  gitUsername: z.string().optional(),
});

export const UpdateProjectDto = z.object({
  name: z.string().min(1).max(64).optional(),
  frameworkType: z.nativeEnum(FrameworkType).optional(),
});

// Pipeline 配置
export const UpdatePipelineConfigDto = z.object({
  installCommand: z.string().optional(),
  buildCommand: z.string().min(1),
  lintCommand: z.string().optional(),
  testCommand: z.string().optional(),
  outputDir: z.string().min(1),
  nodeVersion: z.string().optional(),
  cacheEnabled: z.boolean().optional(),
  timeoutSeconds: z.number().int().min(60).max(3600).optional(),
  ssrEntryPoint: z.string().optional(),
});

// 服务器
export const CreateServerDto = z.object({
  name: z.string().min(1).max(64),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  user: z.string().min(1),
  privateKey: z.string().min(1),
});

// 环境
export const CreateEnvironmentDto = z.object({
  name: z.string().min(1).max(64),
  triggerBranch: z.string().min(1),
  serverId: z.string().uuid(),
  deployPath: z.string().min(1),
  domain: z.string().optional(),
  healthCheckUrl: z.string().url().optional(),
  protected: z.boolean().default(false),
});

export const UpdateEnvironmentDto = CreateEnvironmentDto.partial();

// 环境变量
export const UpsertEnvVariableDto = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[A-Z_][A-Z0-9_]*$/),
  value: z.string(),
});

// 部署
export const TriggerDeployDto = z.object({
  environmentId: z.string().uuid(),
  branch: z.string().optional(),
});

// 审批
export const ReviewApprovalDto = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().max(500).optional(),
});

// 通知配置
export const UpsertNotificationDto = z.object({
  channel: z.string(),
  config: z.record(z.string()),
  events: z.array(z.string()),
  enabled: z.boolean().default(true),
});

// 类型导出
export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;
export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;
export type CreateOrgDtoType = z.infer<typeof CreateOrgDto>;
export type UpdateOrgDtoType = z.infer<typeof UpdateOrgDto>;
export type InviteMemberDtoType = z.infer<typeof InviteMemberDto>;
export type CreateProjectDtoType = z.infer<typeof CreateProjectDto>;
export type UpdatePipelineConfigDtoType = z.infer<typeof UpdatePipelineConfigDto>;
export type CreateServerDtoType = z.infer<typeof CreateServerDto>;
export type CreateEnvironmentDtoType = z.infer<typeof CreateEnvironmentDto>;
export type UpdateEnvironmentDtoType = z.infer<typeof UpdateEnvironmentDto>;
export type UpsertEnvVariableDtoType = z.infer<typeof UpsertEnvVariableDto>;
export type TriggerDeployDtoType = z.infer<typeof TriggerDeployDto>;
export type ReviewApprovalDtoType = z.infer<typeof ReviewApprovalDto>;
