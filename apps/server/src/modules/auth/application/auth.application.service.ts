import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { JwtPayload, TokenPair } from '../domain/auth-session.types';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port';
import {
  AUTH_PASSWORD_RESET_MAILER,
  type AuthPasswordResetMailer,
} from './ports/auth-password-reset-mailer.port';
import { AUTH_PERSISTENCE, type AuthPersistence } from './ports/auth-persistence.port';
import { Inject } from '@nestjs/common';

@Injectable()
export class AuthApplicationService {
  constructor(
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(AUTH_PERSISTENCE) private readonly persistence: AuthPersistence,
    @Inject(AUTH_PASSWORD_RESET_MAILER) private readonly mailer: AuthPasswordResetMailer,
    private readonly jwt: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    const normEmail = email.trim().toLowerCase();
    const existing = await this.persistence.findUserByEmail(normEmail);
    if (existing) throw new ConflictException('邮箱已被注册');

    const passwordHash = await this.passwordHasher.hash(password, 12);
    const user = await this.persistence.createUser({
      name: name.trim(),
      email: normEmail,
      passwordHash,
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.persistence.findUserByEmail(email);
    if (!user?.passwordHash) throw new UnauthorizedException('邮箱或密码错误');

    const valid = await this.passwordHasher.verify(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('邮箱或密码错误');

    return this.issueTokens(user.id, user.email);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.persistence.findRefreshByTokenHash(tokenHash);

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token 无效或已过期');
    }

    const profile = await this.persistence.findUserForProfile(record.userId);
    if (!profile) throw new UnauthorizedException('Refresh token 无效或已过期');

    await this.persistence.revokeRefreshById(record.id);

    return this.issueTokens(profile.id, profile.email);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.persistence.revokeRefreshByTokenHash(tokenHash);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.persistence.findUserByEmail(email);
    if (!user) return;

    await this.persistence.markPasswordResetsUsedForUser(user.id);

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.persistence.insertPasswordReset({ userId: user.id, token, expiresAt });

    await this.mailer.sendPasswordReset(user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.persistence.findPasswordResetByToken(token);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('重置链接无效或已过期');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword, 12);

    await this.persistence.applyPasswordReset({
      userId: record.userId,
      passwordHash,
      resetTokenRecordId: record.id,
    });
  }

  async validateUser(userId: string) {
    return this.persistence.findUserByIdForAuth(userId);
  }

  async getUserById(id: string) {
    return this.persistence.findUserForProfile(id);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.persistence.findUserCredentialsById(userId);
    if (!user?.passwordHash) throw new BadRequestException('账号使用 OAuth 登录，无法修改密码');

    const valid = await this.passwordHasher.verify(oldPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('原密码错误');

    const passwordHash = await this.passwordHasher.hash(newPassword, 12);
    await this.persistence.updatePasswordAndRevokeAllRefresh(userId, passwordHash);
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });

    const rawRefreshToken = uuidv4();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.persistence.insertRefreshToken({ userId, tokenHash, expiresAt });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
