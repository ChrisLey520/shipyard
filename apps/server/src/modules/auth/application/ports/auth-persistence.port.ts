/** 认证相关持久化端口（Prisma 实现在 infrastructure） */

import type { User } from '@prisma/client';

export interface AuthUserCredentials {
  id: string;
  email: string;
  passwordHash: string | null;
}

export interface AuthUserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  locale: string | null;
  themeId: string | null;
  colorMode: string | null;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  usedAt: Date | null;
  expiresAt: Date;
}

export interface AuthPersistence {
  /** JWT 校验后挂到 request.user 的完整用户实体 */
  findUserByIdForAuth(id: string): Promise<User | null>;
  findUserCredentialsById(id: string): Promise<AuthUserCredentials | null>;
  findUserByEmail(email: string): Promise<AuthUserCredentials | null>;
  createUser(data: { name: string; email: string; passwordHash: string }): Promise<{ id: string; email: string }>;
  findRefreshByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshById(id: string): Promise<void>;
  insertRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  revokeRefreshByTokenHash(tokenHash: string): Promise<void>;
  markPasswordResetsUsedForUser(userId: string): Promise<void>;
  insertPasswordReset(data: { userId: string; token: string; expiresAt: Date }): Promise<void>;
  findPasswordResetByToken(token: string): Promise<PasswordResetRecord | null>;
  /** 重置密码：更新密码、作废 reset token、吊销全部 refresh */
  applyPasswordReset(params: {
    userId: string;
    passwordHash: string;
    resetTokenRecordId: string;
  }): Promise<void>;
  findUserForProfile(id: string): Promise<AuthUserProfile | null>;
  /** 修改密码并吊销所有 refresh */
  updatePasswordAndRevokeAllRefresh(userId: string, passwordHash: string): Promise<void>;
}

export const AUTH_PERSISTENCE = Symbol('AUTH_PERSISTENCE');
