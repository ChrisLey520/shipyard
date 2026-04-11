import { Injectable, Logger } from '@nestjs/common';
import { GitProvider } from '@shipyard/shared';
import { DeployService } from '../../deploy/deploy.service';
import { validate as isUuid } from 'uuid';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { RedisService } from '../../../common/redis/redis.service';
import { PipelineService } from '../../pipeline/pipeline.service';
import type {
  WebhookHttpResponse,
  WebhooksGitProvider,
  ParsedPushPayload,
  ParsedPullRequestPayload,
} from '../webhook-types';
import {
  githubWebhookIdempotencyKey,
  verifyGithubWebhookSignature,
  parseGithubWebhookEvent,
  parseGithubPushPayload,
  parseGithubPullRequestPayload,
} from '../adapters/github-webhook.adapter';
import {
  gitlabWebhookIdempotencyKey,
  verifyGitlabWebhookToken,
  parseGitlabWebhookEvent,
  parseGitlabPushPayload,
  parseGitlabMergeRequestPayload,
} from '../adapters/gitlab-webhook.adapter';
import {
  giteeWebhookIdempotencyKey,
  verifyGiteeWebhookToken,
  parseGiteePushPayload,
  parseGiteeMergeRequestPayload,
} from '../adapters/gitee-webhook.adapter';
import {
  giteaWebhookIdempotencyKey,
  verifyGiteaWebhookSignature,
  parseGiteaWebhookEvent,
  parseGiteaPushPayload,
  parseGiteaPullRequestPayload,
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

function isPreviewPrClosed(parsed: ParsedPullRequestPayload): boolean {
  const s = parsed.prState.toLowerCase();
  const a = parsed.action.toLowerCase();
  return (
    s === 'closed' ||
    s === 'merged' ||
    a === 'closed' ||
    a === 'close' ||
    a === 'merge'
  );
}

function shouldQueuePreviewBuild(parsed: ParsedPullRequestPayload): boolean {
  const a = parsed.action.toLowerCase();
  return (
    a === 'opened' ||
    a === 'synchronize' ||
    a === 'reopened' ||
    a === 'open' ||
    a === 'update' ||
    a === 'reopen'
  );
}

@Injectable()
export class WebhooksApplicationService {
  private readonly logger = new Logger(WebhooksApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
    private readonly pipeline: PipelineService,
    private readonly deployService: DeployService,
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

    if (provider === GitProvider.GITHUB) {
      const ghEvent = parseGithubWebhookEvent(headers);
      if (ghEvent === 'ping') {
        return this.ok(200, { handled: false });
      }
      if (ghEvent === 'pull_request') {
        if (!gitConn.project) {
          return this.err(404, 'not_found');
        }
        const parsed = parseGithubPullRequestPayload(payload);
        if (!parsed) {
          return this.ok(200, { skipped: true, reason: 'invalid_pr_payload' });
        }
        return this.handlePullRequest(
          projectId,
          gitConn as typeof gitConn & { project: NonNullable<typeof gitConn.project> },
          parsed,
        );
      }
    }

    if (provider === GitProvider.GITLAB && parseGitlabWebhookEvent(headers) === 'Merge Request Hook') {
      if (!gitConn.project) {
        return this.err(404, 'not_found');
      }
      const parsed = parseGitlabMergeRequestPayload(payload);
      if (!parsed) {
        return this.ok(200, { skipped: true, reason: 'invalid_pr_payload' });
      }
      return this.handlePullRequest(
        projectId,
        gitConn as typeof gitConn & { project: NonNullable<typeof gitConn.project> },
        parsed,
      );
    }

    if (provider === GitProvider.GITEA && parseGiteaWebhookEvent(headers).toLowerCase() === 'pull_request') {
      if (!gitConn.project) {
        return this.err(404, 'not_found');
      }
      const parsed = parseGiteaPullRequestPayload(payload);
      if (!parsed) {
        return this.ok(200, { skipped: true, reason: 'invalid_pr_payload' });
      }
      return this.handlePullRequest(
        projectId,
        gitConn as typeof gitConn & { project: NonNullable<typeof gitConn.project> },
        parsed,
      );
    }

    if (provider === GitProvider.GITEE && String(payload['hook_name'] ?? '') === 'merge_request_hooks') {
      if (!gitConn.project) {
        return this.err(404, 'not_found');
      }
      const parsed = parseGiteeMergeRequestPayload(payload);
      if (!parsed) {
        return this.ok(200, { skipped: true, reason: 'invalid_pr_payload' });
      }
      return this.handlePullRequest(
        projectId,
        gitConn as typeof gitConn & { project: NonNullable<typeof gitConn.project> },
        parsed,
      );
    }

    if (this.isNonPushPing(provider, headers, payload)) {
      return this.ok(200, { handled: false });
    }

    if (provider === GitProvider.GITEE) {
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
      case GitProvider.GITHUB:
        return verifyGithubWebhookSignature(secret, rawBody, headers['x-hub-signature-256'] ?? '');
      case GitProvider.GITLAB:
        return verifyGitlabWebhookToken(secret, headers);
      case GitProvider.GITEE:
        return verifyGiteeWebhookToken(secret, headers);
      case GitProvider.GITEA: {
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
      case GitProvider.GITHUB:
        return githubWebhookIdempotencyKey(headers, rawBody);
      case GitProvider.GITLAB:
        return gitlabWebhookIdempotencyKey(headers, payload);
      case GitProvider.GITEE:
        return giteeWebhookIdempotencyKey(payload);
      case GitProvider.GITEA:
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
      case GitProvider.GITHUB: {
        const ev = parseGithubWebhookEvent(headers);
        return (
          ev === 'ping' ||
          (ev !== '' && ev !== 'push' && ev !== 'pull_request')
        );
      }
      case GitProvider.GITLAB: {
        const ev = parseGitlabWebhookEvent(headers);
        return ev !== '' && ev !== 'Push Hook';
      }
      case GitProvider.GITEE:
        return false; // 非 push 由 hook_name 在 handleWebhook 中单独判断
      case GitProvider.GITEA: {
        const ev = parseGiteaWebhookEvent(headers);
        return ev !== '' && ev.toLowerCase() !== 'push';
      }
      default: {
        const _exhaustive: never = provider;
        return _exhaustive;
      }
    }
  }

  private async handlePullRequest(
    projectId: string,
    gitConn: {
      gitProvider: string;
      project: {
        id: string;
        slug: string;
        repoFullName: string;
        previewEnabled: boolean;
        previewServerId: string | null;
        previewBaseDomain: string | null;
        organization: { id: string };
      };
    },
    parsed: ParsedPullRequestPayload,
  ): Promise<WebhookHttpResponse> {
    const project = gitConn.project;
    if (!project.previewEnabled) {
      return this.ok(200, { handled: false, reason: 'preview_disabled' });
    }
    if (!project.previewServerId || !project.previewBaseDomain?.trim()) {
      return this.ok(200, { handled: false, reason: 'preview_not_configured' });
    }

    const expectedBase = normalizeRepoKey(project.repoFullName);
    if (normalizeRepoKey(parsed.baseRepoFullName) !== expectedBase) {
      return this.err(422, 'repository_mismatch');
    }

    if (normalizeRepoKey(parsed.headRepoFullName) !== normalizeRepoKey(parsed.baseRepoFullName)) {
      return this.ok(200, { handled: false, reason: 'fork_pr_skipped' });
    }

    const orgId = project.organization.id;

    if (isPreviewPrClosed(parsed)) {
      void this.deployService
        .teardownPreviewForPr(orgId, projectId, parsed.prNumber)
        .catch((e) => this.logger.error(`Preview teardown failed: ${e}`));
      return this.ok(200, { preview: 'teardown_started' });
    }

    if (!shouldQueuePreviewBuild(parsed)) {
      return this.ok(200, { handled: false, reason: 'pr_action_ignored' });
    }

    const { deployment, previewId, deduped } = await this.pipeline.enqueuePrPreviewBuild(orgId, projectId, {
      prNumber: parsed.prNumber,
      headSha: parsed.headSha,
      headBranch: parsed.headBranch,
      commitMessage: parsed.commitMessage || '(no title)',
      commitAuthor: parsed.commitAuthor || 'unknown',
      previewBaseDomain: project.previewBaseDomain!.trim(),
      gitProvider: gitConn.gitProvider,
    });

    if (deduped) {
      return this.ok(200, { deduped: true, deploymentId: deployment.id, previewId });
    }
    this.logger.log(`Queued PR preview build for ${project.slug} PR#${parsed.prNumber}`);
    return this.ok(200, { queued: 1, deploymentId: deployment.id, previewId });
  }

  private parsePush(provider: WebhooksGitProvider, payload: Record<string, unknown>): ParsedPushPayload | null {
    switch (provider) {
      case GitProvider.GITHUB:
        return parseGithubPushPayload(payload);
      case GitProvider.GITLAB:
        return parseGitlabPushPayload(payload);
      case GitProvider.GITEE:
        return parseGiteePushPayload(payload);
      case GitProvider.GITEA:
        return parseGiteaPushPayload(payload);
      default: {
        const _exhaustive: never = provider;
        return _exhaustive;
      }
    }
  }
}
