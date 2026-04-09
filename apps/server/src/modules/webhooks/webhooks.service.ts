import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RedisService } from '../../common/redis/redis.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { createHmac, createHash } from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
    private readonly pipeline: PipelineService,
  ) {}

  async handleGithubWebhook(headers: Record<string, string>, rawBody: string) {
    const signature = headers['x-hub-signature-256'] ?? '';
    const deliveryId = headers['x-github-delivery'] ?? '';
    const event = headers['x-github-event'] ?? '';

    // 幂等去重
    const idempotencyKey = `webhook:github:${deliveryId}`;
    const isNew = await this.redis.checkAndSetIdempotency(idempotencyKey);
    if (!isNew) {
      this.logger.debug(`Duplicate webhook delivery: ${deliveryId}`);
      return { skipped: true };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { error: 'Invalid JSON' };
    }

    const repoFullName = (payload['repository'] as { full_name?: string })?.full_name;
    if (!repoFullName) return { error: 'No repository info' };

    // 找到对应的 GitConnection
    const gitConn = await this.prisma.gitConnection.findFirst({
      where: {
        gitProvider: 'github',
        project: { repoFullName },
      },
      include: { project: { include: { organization: true, environments: true } } },
    });

    if (!gitConn || !gitConn.project) {
      this.logger.debug(`No project found for repo: ${repoFullName}`);
      return { skipped: true };
    }

    // 验证签名
    const secret = this.crypto.decrypt(gitConn.webhookSecret);
    const expectedSig = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    if (signature !== expectedSig) {
      this.logger.warn(`Invalid webhook signature for ${repoFullName}`);
      return { error: 'Invalid signature' };
    }

    const project = gitConn.project;
    const orgId = project.organization.id;

    if (event === 'push') {
      const ref = payload['ref'] as string;
      const branch = ref?.replace('refs/heads/', '');
      const commits = payload['commits'] as Array<{ id: string; message: string; author: { name: string } }>;
      const headCommit = (payload['head_commit'] as { id: string; message: string; author: { name: string } }) ?? commits?.[0];

      if (!branch || !headCommit) return { skipped: true };

      // 找到所有匹配此 branch 的 Environment
      const matchingEnvs = project.environments.filter((e) => e.triggerBranch === branch);

      for (const env of matchingEnvs) {
        await this.pipeline.enqueueBuild(
          orgId,
          project.id,
          env.id,
          headCommit.id,
          branch,
          headCommit.message,
          headCommit.author.name,
        );
        this.logger.log(`Queued build for ${project.slug} env:${env.name} branch:${branch}`);
      }

      return { queued: matchingEnvs.length };
    }

    return { event, handled: false };
  }

  /**
   * Gitee 无 Delivery UUID，用内容 hash 去重
   */
  buildGiteeIdempotencyKey(payload: Record<string, unknown>): string {
    const repoId = String((payload['repository'] as { id?: number })?.id ?? '');
    const sha = String((payload['head_commit'] as { id?: string })?.id ?? '');
    const event = String(payload['event'] ?? '');
    return `webhook:gitee:${createHash('sha256').update(`${event}:${repoId}:${sha}`).digest('hex')}`;
  }
}
