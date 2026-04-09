import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import * as https from 'https';
import * as http from 'http';
import * as dns from 'dns';
import { isPrivateIpv4 } from '@shipyard/shared';

interface NotifyJobData {
  projectId: string;
  event: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotifyWorkerService implements OnModuleInit {
  private readonly logger = new Logger(NotifyWorkerService.name);
  private workers = new Map<string, Worker>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      this.startWorkerForOrg(org.id);
    }
    this.logger.log(`NotifyWorker initialized for ${orgs.length} organizations`);
  }

  private startWorkerForOrg(orgId: string) {
    if (this.workers.has(orgId)) return;
    const worker = new Worker<NotifyJobData>(
      `notify:${orgId}`,
      async (job) => this.processNotify(job.data),
      { connection: this.redis.getClient(), concurrency: 5 },
    );
    this.workers.set(orgId, worker);
  }

  private async processNotify(data: NotifyJobData) {
    const configs = await this.prisma.notification.findMany({
      where: {
        projectId: data.projectId,
        enabled: true,
        events: { has: data.event },
      },
    });

    for (const config of configs) {
      try {
        switch (config.channel) {
          case 'webhook':
            await this.sendWebhook(config.config as { url: string }, data.payload);
            break;
          default:
            this.logger.debug(`Channel ${config.channel} not yet implemented`);
        }
      } catch (err) {
        this.logger.error(`Notification failed: ${err}`);
      }
    }
  }

  /** SSRF 防护 Webhook 发送 */
  private async sendWebhook(config: { url: string }, payload: unknown) {
    const url = new URL(config.url);

    // DNS 解析后校验 IP
    const resolved = await new Promise<string>((resolve, reject) => {
      dns.lookup(url.hostname, (err, address) => {
        if (err) reject(err);
        else resolve(address);
      });
    });

    if (isPrivateIpv4(resolved)) {
      throw new Error(`SSRF 防护：目标 IP ${resolved} 是私有地址`);
    }

    // IPv6 loopback 校验
    if (resolved === '::1' || resolved.startsWith('fe80')) {
      throw new Error(`SSRF 防护：禁止 IPv6 私有地址`);
    }

    const body = JSON.stringify(payload);
    const client = config.url.startsWith('https') ? https : http;

    await new Promise<void>((resolve, reject) => {
      const req = client.request(
        config.url,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 400) resolve();
          else reject(new Error(`Webhook 返回 HTTP ${res.statusCode}`));
        },
      );
      req.on('error', reject);
      req.setTimeout(10_000, () => reject(new Error('Webhook 超时')));
      req.write(body);
      req.end();
    });
  }
}
