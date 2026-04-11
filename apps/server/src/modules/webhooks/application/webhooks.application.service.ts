import { Injectable, Logger } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { RedisService } from '../../../common/redis/redis.service';
import { PipelineService } from '../../pipeline/pipeline.service';
import type { WebhookHttpResponse, WebhooksGitProvider, ParsedPushPayload } from '../webhook-types';
import {
  githubWebhookIdempotencyKey,
  verifyGithubWebhookSignature,
  parseGithubWebhookEvent,
  parseGithubPushPayload,
} from '../adapters/github-webhook.adapter';
import {
  gitlabWebhookIdempotencyKey,
  verifyGitlabWebhookToken,
  parseGitlabWebhookEvent,
  parseGitlabPushPayload,
} from '../adapters/gitlab-webhook.adapter';
import { giteeWebhookIdempotencyKey, verifyGiteeWebhookToken, parseGiteePushPayload } from '../adapters/gitee-webhook.adapter';
import {
  giteaWebhookIdempotencyKey,
  verifyGiteaWebhookSignature,
  parseGiteaWebhookEvent,
  parseGiteaPushPayload,
} from '../adapters/gitea-webhook.adapter';

function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined) out[k.toLowerCase()] = val;
  }
  return out;
}

function normalizeRepoKey(name: string): string {
  return name.trim().toLowerCase();
}

@Injectable()
export class WebhooksApplicationService {
  private readonly logger = new Logger(WebhooksApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
    private readonly pipeline: PipelineService,
  ) {}

  protected ok(status: number, body: Record<string, unknown>): WebhookHttpResponse {
    return { status, body };
  }

  protected err(status: number, error: string): WebhookHttpResponse {
    return { status, body: { error } };
  }

  async handleWebhook(
    provider: WebhooksGitProvider,
    p: string | undefined,
    headersIn: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<WebhookHttpResponse> {
    const headers = normalizeHeaders(headersIn);

    if (!p?.trim() || !isUuid(p.trim())) {
      return this.err(400, 'invalid_request');
    }
    const projectId = p.trim();

    let gitConn;
    try {
      gitConn = await this.prisma.gitConnection.findUnique({
        where: { projectId },
        include: { project: { include: { organization: true, environments: true } } },
      });
    } catch {
      return this.err(500, 'service_unavailable');
    }

    if (!gitConn?.project || gitConn.gitProvider !== provider) {
      return this.err(404, 'not_found');
    }

    let secret: string;
    try {
      secret = this.crypto.decrypt(gitConn.webhookSecret);
    } catch {
      this.logger.error(`Webhook secret decrypt failed projectId=${projectId}`);
      return this.err(500, 'service_unavailable');
    }

    const sigOk = this.verifyProviderSignature(provider, secret, headers, rawBody);
    if (!sigOk) {
      this.logger.warn(`Invalid webhook signature provider=${provider} projectId=${projectId}`);
      return this.err(401, 'invalid_signature');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return this.err(400, 'invalid_request');
    }

    const idemKey = this.idempotencyKey(provider, headers, rawBody, payload);
    try {
      const isNew = await this.redis.checkAndSetIdempotency(idemKey);
      if (!isNew) {
        return this.ok(200, { skipped: true, reason: 'duplicate_delivery' });
      }
    } catch (e) {
      this.logger.error(`Redis idempotency failed: ${e}`);
      return this.err(503, 'service_unavailable');
    }

    if (this.isNonPushPing(provider, headers, payload)) {
      return this.ok(200, { handled: false });
    }

    if (provider === 'gitee') {
      const hn = String(payload['hook_name'] ?? '');
      if (hn && hn !== 'push_hooks') {
        return this.ok(200, { handled: false });
      }
    }

    const parsed = this.parsePush(provider, payload);
    if (!parsed) {
      return this.ok(200, { queued: 0, skipped: true });
    }

    const expectedRepo = normalizeRepoKey(gitConn.project.repoFullName);
    if (normalizeRepoKey(parsed.repoFullName) !== expectedRepo) {
      return this.err(422, 'repository_mismatch');
    }

    const project = gitConn.project;
    const orgId = project.organization.id;
    const matchingEnvs = project.environments.filter((e) => e.triggerBranch === parsed.branch);

    if (matchingEnvs.length === 0) {
      return this.ok(200, { queued: 0 });
    }

    let queued = 0;
    const deduped: string[] = [];
    for (const env of matchingEnvs) {
      const { deployment, deduped: wasDeduped } = await this.pipeline.enqueueBuild(
        orgId,
        project.id,
        env.id,
        parsed.commitSha,
        parsed.branch,
        parsed.commitMessage,
        parsed.commitAuthor,
        undefined,
      );
      if (wasDeduped) {
        deduped.push(deployment.id);
      } else {
        queued += 1;
        this.logger.log(`Queued build for ${project.slug} env:${env.name} branch:${parsed.branch}`);
      }
    }

    if (deduped.length > 0 && queued === 0) {
      return this.ok(200, {
        deduped: true,
        existingDeploymentId: deduped[0],
      });
    }

    return this.ok(200, {
      queued,
      ...(deduped.length ? { dedupedIds: deduped } : {}),
    });
  }

  private verifyProviderSignature(
    provider: WebhooksGitProvider,
    secret: string,
    headers: Record<string, string>,
    rawBody: string,
  ): boolean {
    switch (provider) {
      case 'github':
        return verifyGithubWebhookSignature(secret, rawBody, headers['x-hub-signature-256'] ?? '');
      case 'gitlab':
        return verifyGitlabWebhookToken(secret, headers);
      case 'gitee':
        return verifyGiteeWebhookToken(secret, headers);
      case 'gitea': {
        const sig = headers['x-gitea-signature'] ?? '';
        return verifyGiteaWebhookSignature(secret, rawBody, sig);
      }
      default: {
        const _exhaustive: never = provider;
        return _exhaustive;
      }
    }
  }

  private idempotencyKey(
    provider: WebhooksGitProvider,
    headers: Record<string, string>,
    rawBody: string,
    payload: Record<string, unknown>,
  ): string {
    switch (provider) {
      case 'github':
        return githubWebhookIdempotencyKey(headers, rawBody);
      case 'gitlab':
        return gitlabWebhookIdempotencyKey(headers, payload);
      case 'gitee':
        return giteeWebhookIdempotencyKey(payload);
      case 'gitea':
        return giteaWebhookIdempotencyKey(headers, rawBody);
      default: {
        const _exhaustive: never = provider;
        return _exhaustive;
      }
    }
  }

  private isNonPushPing(
    provider: WebhooksGitProvider,
    headers: Record<string, string>,
    _payload: Record<string, unknown>,
  ): boolean {
    switch (provider) {
      case 'github': {
        const ev = parseGithubWebhookEvent(headers);
        return ev === 'ping' || (ev !== '' && ev !== 'push');
      }
      case 'gitlab': {
        const ev = parseGitlabWebhookEvent(headers);
        return ev !== '' && ev !== 'Push Hook';
      }
      case 'gitee':
        return false; // 非 push 由 hook_name 在 handleWebhook 中单独判断
      case 'gitea': {
        const ev = parseGiteaWebhookEvent(headers);
        return ev !== '' && ev.toLowerCase() !== 'push';
      }
      default: {
        const _exhaustive: never = provider;
        return _exhaustive;
      }
    }
  }

  private parsePush(provider: WebhooksGitProvider, payload: Record<string, unknown>): ParsedPushPayload | null {
    switch (provider) {
      case 'github':
        return parseGithubPushPayload(payload);
      case 'gitlab':
        return parseGitlabPushPayload(payload);
      case 'gitee':
        return parseGiteePushPayload(payload);
      case 'gitea':
        return parseGiteaPushPayload(payload);
      default: {
        const _exhaustive: never = provider;
        return _exhaustive;
      }
    }
  }

  /** @deprecated 保留兼容；新逻辑见各 adapter */
  buildGiteeIdempotencyKey(payload: Record<string, unknown>): string {
    return giteeWebhookIdempotencyKey(payload);
  }
}
