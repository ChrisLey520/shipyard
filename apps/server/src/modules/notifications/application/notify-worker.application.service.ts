import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import * as nodemailer from 'nodemailer';
import { NotificationChannel } from '@shipyard/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { assertSafeOutboundHttpUrl } from '../outbound-url-guard';
import { decryptNotificationSecrets } from '../notification-config.crypto';

export interface NotifyJobData {
  projectId: string;
  event: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotifyWorkerApplicationService {
  protected readonly logger = new Logger(NotifyWorkerApplicationService.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly crypto: CryptoService,
  ) {}

  async processNotify(data: NotifyJobData): Promise<void> {
    const configs = await this.prisma.notification.findMany({
      where: {
        projectId: data.projectId,
        enabled: true,
        events: { has: data.event },
      },
    });

    const text = this.buildNotifyText(data.payload);

    for (const row of configs) {
      try {
        const plain = decryptNotificationSecrets(this.crypto, row.channel, row.config as Record<string, unknown>);
        switch (row.channel) {
          case NotificationChannel.WEBHOOK:
            await this.sendWebhook(plain as { url: string }, data.payload);
            break;
          case NotificationChannel.FEISHU:
            await this.sendFeishu(plain as { url: string }, text);
            break;
          case NotificationChannel.DINGTALK:
            await this.sendDingtalk(plain as { url: string }, text);
            break;
          case NotificationChannel.SLACK:
            await this.sendSlack(plain as { url: string }, text);
            break;
          case NotificationChannel.EMAIL:
            await this.sendEmail(
              plain as {
                smtpHost: string;
                smtpPort: number;
                smtpSecure?: boolean;
                smtpUser: string;
                smtpPass?: string;
                from: string;
                to?: string;
              },
              data.event,
              text,
            );
            break;
          default:
            this.logger.debug(`未知通知渠道: ${row.channel}`);
        }
      } catch (err) {
        this.logger.error(`Notification failed: ${err}`);
      }
    }
  }

  private buildNotifyText(payload: Record<string, unknown>): string {
    const msg = String(payload['message'] ?? 'Shipyard');
    const keys = ['event', 'detailUrl', 'deploymentId', 'projectSlug', 'orgSlug', 'approvalId'] as const;
    const lines = keys
      .map((k) => {
        const v = payload[k];
        if (v === undefined || v === null || v === '') return null;
        return `${k}: ${String(v)}`;
      })
      .filter((x): x is string => x != null);
    return lines.length ? `${msg}\n${lines.join('\n')}` : msg;
  }

  private async postJson(url: string, body: unknown): Promise<void> {
    const urlObj = await assertSafeOutboundHttpUrl(url);
    const bodyStr = JSON.stringify(body);
    const client = urlObj.protocol === 'https:' ? https : http;
    await new Promise<void>((resolve, reject) => {
      const req = client.request(
        urlObj.href,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(bodyStr),
          },
        },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 400) resolve();
          else reject(new Error(`HTTP ${res.statusCode}`));
        },
      );
      req.on('error', reject);
      req.setTimeout(10_000, () => reject(new Error('请求超时')));
      req.write(bodyStr);
      req.end();
    });
  }

  private async sendWebhook(config: { url: string }, payload: unknown) {
    await this.postJson(config.url, payload);
  }

  private async sendFeishu(config: { url: string }, text: string) {
    await this.postJson(config.url, {
      msg_type: 'text',
      content: { text },
    });
  }

  private async sendDingtalk(config: { url: string }, text: string) {
    await this.postJson(config.url, {
      msgtype: 'markdown',
      markdown: { title: 'Shipyard', text: `### Shipyard\n\n${text.replace(/\n/g, '\n\n')}` },
    });
  }

  private async sendSlack(config: { url: string }, text: string) {
    await this.postJson(config.url, { text });
  }

  private async sendEmail(
    config: {
      smtpHost: string;
      smtpPort: number;
      smtpSecure?: boolean;
      smtpUser: string;
      smtpPass?: string;
      from: string;
      to?: string;
    },
    subjectEvent: string,
    text: string,
  ) {
    const pass = config.smtpPass ?? '';
    if (!pass) {
      throw new Error('email 渠道未配置 smtpPass');
    }
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(config.smtpPort),
      secure: config.smtpSecure === true,
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
      auth: { user: config.smtpUser, pass },
    });
    const to = (typeof config.to === 'string' && config.to.trim()) ? config.to.trim() : config.smtpUser;
    await transporter.sendMail({
      from: config.from,
      to,
      subject: `[Shipyard] ${subjectEvent}`,
      text,
    });
  }
}
