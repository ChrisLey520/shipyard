import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { AuthPasswordResetMailer } from './application/ports/auth-password-reset-mailer.port';

@Injectable()
export class MailService implements AuthPasswordResetMailer {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly appUrl: string;

  constructor() {
    this.from = process.env['MAIL_FROM'] ?? 'noreply@shipyard.local';
    this.appUrl = process.env['APP_URL'] ?? 'http://localhost:5173';
    this.transporter = nodemailer.createTransport({
      host: process.env['SMTP_HOST'] ?? 'localhost',
      port: parseInt(process.env['SMTP_PORT'] ?? '587'),
      secure: process.env['SMTP_SECURE'] === 'true',
      auth: process.env['SMTP_USER']
        ? {
            user: process.env['SMTP_USER'],
            pass: process.env['SMTP_PASS'],
          }
        : undefined,
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: '重置你的 Shipyard 密码',
        html: `
          <h2>密码重置</h2>
          <p>点击下方链接重置密码（链接 1 小时内有效）：</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>如果你没有发起此请求，请忽略此邮件。</p>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send password reset email', err);
    }
  }

  async sendOrgInvitation(
    to: string,
    orgName: string,
    inviterName: string,
    token: string,
  ): Promise<void> {
    const inviteUrl = `${this.appUrl}/invite?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `${inviterName} 邀请你加入 ${orgName}`,
        html: `
          <h2>组织邀请</h2>
          <p>${inviterName} 邀请你加入 <strong>${orgName}</strong>。</p>
          <p><a href="${inviteUrl}">点击接受邀请</a></p>
          <p>链接 7 天内有效。</p>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send invitation email', err);
    }
  }
}
