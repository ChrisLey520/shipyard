import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  AuthPersistence,
  AuthUserCredentials,
  AuthUserProfile,
  PasswordResetRecord,
  RefreshTokenRecord,
} from '../application/ports/auth-persistence.port';

@Injectable()
export class PrismaAuthPersistence implements AuthPersistence {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByIdForAuth(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findUserCredentialsById(id: string): Promise<AuthUserCredentials | null> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, passwordHash: true },
    });
    return u;
  }

  async findUserByEmail(email: string): Promise<AuthUserCredentials | null> {
    const key = email.trim().toLowerCase();
    const rows = await this.prisma.$queryRaw<{ id: string; email: string; passwordHash: string | null }[]>(
      Prisma.sql`
        SELECT id, email, "passwordHash"
        FROM "User"
        WHERE LOWER(TRIM(email)) = ${key}
        LIMIT 1
      `,
    );
    const u = rows[0];
    if (!u) return null;
    return { id: u.id, email: u.email, passwordHash: u.passwordHash };
  }

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<{ id: string; email: string }> {
    const u = await this.prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash: data.passwordHash },
      select: { id: true, email: true },
    });
    return u;
  }

  async findRefreshByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });
  }

  async revokeRefreshById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async insertRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  async revokeRefreshByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async markPasswordResetsUsedForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async insertPasswordReset(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.passwordResetToken.create({ data });
  }

  async findPasswordResetByToken(token: string): Promise<PasswordResetRecord | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
  }

  async applyPasswordReset(params: {
    userId: string;
    passwordHash: string;
    resetTokenRecordId: string;
  }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: params.userId },
        data: { passwordHash: params.passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: params.resetTokenRecordId },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async findUserForProfile(id: string): Promise<AuthUserProfile | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        locale: true,
        themeId: true,
        colorMode: true,
        createdAt: true,
      },
    });
  }

  async updatePasswordAndRevokeAllRefresh(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
