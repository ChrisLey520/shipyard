import { Injectable, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { NotifyWorkerApplicationService, type NotifyJobData } from './application/notify-worker.application.service';

@Injectable()
export class NotifyWorkerService extends NotifyWorkerApplicationService implements OnModuleInit {
  private workers = new Map<string, Worker>();

  constructor(
    prisma: PrismaService,
    crypto: CryptoService,
    private readonly redis: RedisService,
  ) {
    super(prisma, crypto);
  }

  async onModuleInit() {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      this.startWorkerForOrg(org.id);
    }

    const sub = this.redis.getSubscriber();
    await sub.subscribe('worker:new-org');
    sub.on('message', (_ch: string, orgId: string) => {
      void this.prisma.organization
        .findUnique({ where: { id: orgId }, select: { id: true } })
        .then((row) => {
          if (row) this.startWorkerForOrg(orgId);
        });
    });

    this.logger.log(`NotifyWorker initialized for ${orgs.length} organizations`);
  }

  private startWorkerForOrg(orgId: string) {
    if (this.workers.has(orgId)) return;
    const worker = new Worker<NotifyJobData>(
      `notify-${orgId}`,
      async (job) => this.processNotify(job.data),
      { connection: this.redis.getClient(), concurrency: 5 },
    );
    this.workers.set(orgId, worker);
  }
}
