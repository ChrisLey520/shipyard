import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { DeployService } from './deploy.service';

@Injectable()
export class DeployWorkerService implements OnModuleInit {
  private readonly logger = new Logger(DeployWorkerService.name);
  private workers = new Map<string, Worker>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly deployService: DeployService,
  ) {}

  async onModuleInit() {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      this.startWorkerForOrg(org.id);
    }

    const sub = this.redis.getSubscriber();
    await sub.subscribe('worker:new-org');
    sub.on('message', (_ch: string, orgId: string) => {
      this.startWorkerForOrg(orgId);
    });

    this.logger.log(`DeployWorker initialized for ${orgs.length} organizations`);
  }

  private startWorkerForOrg(orgId: string) {
    if (this.workers.has(orgId)) return;

    const worker = new Worker(
      `deploy-${orgId}`,
      async (job) => this.deployService.deploy(job.data as Parameters<typeof this.deployService.deploy>[0]),
      {
        connection: this.redis.getClient(),
        concurrency: 2,
      },
    );

    worker.on('failed', (job, err) => {
      this.logger.error(`Deploy job ${job?.id} failed: ${err.message}`);
    });

    this.workers.set(orgId, worker);
  }
}
