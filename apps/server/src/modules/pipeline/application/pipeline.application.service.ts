import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { Queue } from 'bullmq';
import { Prisma, type Deployment } from '@prisma/client';
import { buildPreviewFqdn } from '@shipyard/shared';

export interface BuildJobData {
  deploymentId: string;
  projectId: string;
  environmentId: string | null;
  orgId: string;
  /** PR 预览构建时携带，便于 Worker 入队预览部署 */
  previewId?: string | null;
}

@Injectable()
export class PipelineApplicationService {
  private queues = new Map<string, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  getOrCreateQueue(orgId: string): Queue {
    if (!this.queues.has(orgId)) {
      const q = new Queue(`build-${orgId}`, {
        connection: this.redis.getClient(),
      });
      this.queues.set(orgId, q);
    }
    return this.queues.get(orgId)!;
  }

  async enqueueBuild(
    orgId: string,
    projectId: string,
    environmentId: string | null,
    commitSha: string,
    branch: string,
    commitMessage: string,
    commitAuthor: string,
    triggeredByUserId?: string,
  ): Promise<{ deployment: Deployment; deduped: boolean }> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { pipelineConfig: true },
    });

    // Webhook 入队去重：同 (project, env, commit) 且仍处于进行中时不重复入队
    if (!triggeredByUserId && environmentId) {
      const existing = await this.prisma.deployment.findFirst({
        where: {
          projectId,
          environmentId,
          commitSha,
          status: { in: ['queued', 'building', 'pending_approval'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        return { deployment: existing, deduped: true };
      }
    }

    // 快照当前 PipelineConfig（不含 EnvVariable 值）
    const configSnapshot = project.pipelineConfig
      ? ({
          buildCommand: project.pipelineConfig.buildCommand,
          installCommand: project.pipelineConfig.installCommand,
          outputDir: project.pipelineConfig.outputDir,
          nodeVersion: project.pipelineConfig.nodeVersion,
          ssrEntryPoint: project.pipelineConfig.ssrEntryPoint ?? null,
          previewHealthCheckPath: project.pipelineConfig.previewHealthCheckPath ?? null,
        } satisfies Prisma.InputJsonValue)
      : undefined;

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        environmentId,
        status: 'queued',
        trigger: triggeredByUserId ? 'manual' : 'webhook',
        triggeredByUserId,
        commitSha,
        branch,
        commitMessage,
        commitAuthor,
        configSnapshot,
      },
    });

    const queue = this.getOrCreateQueue(orgId);
    await queue.add(
      'build',
      { deploymentId: deployment.id, projectId, environmentId, orgId } satisfies BuildJobData,
      { jobId: `deploy-${deployment.id}` },
    );

    return { deployment, deduped: false };
  }

  /**
   * PR 预览：创建 Deployment + upsert Preview并入队构建（GitHub pull_request 等）
   */
  async enqueuePrPreviewBuild(
    orgId: string,
    projectId: string,
    pr: {
      prNumber: number;
      headSha: string;
      headBranch: string;
      commitMessage: string;
      commitAuthor: string;
      previewBaseDomain: string;
      gitProvider: string;
    },
  ): Promise<{ deployment: Deployment; previewId: string; deduped: boolean }> {
    const dup = await this.prisma.deployment.findFirst({
      where: {
        projectId,
        environmentId: null,
        commitSha: pr.headSha,
        trigger: 'pr_preview',
        status: { in: ['queued', 'building', 'deploying'] },
        preview: { prNumber: pr.prNumber },
      },
    });
    if (dup) {
      const byPr =
        (await this.prisma.preview.findUnique({
          where: { projectId_prNumber: { projectId, prNumber: pr.prNumber } },
        })) ??
        (await this.prisma.preview.findUnique({ where: { deploymentId: dup.id } }));
      return { deployment: dup, previewId: byPr?.id ?? '', deduped: true };
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { pipelineConfig: true },
    });

    const configSnapshot = project.pipelineConfig
      ? ({
          buildCommand: project.pipelineConfig.buildCommand,
          installCommand: project.pipelineConfig.installCommand,
          outputDir: project.pipelineConfig.outputDir,
          nodeVersion: project.pipelineConfig.nodeVersion,
          ssrEntryPoint: project.pipelineConfig.ssrEntryPoint ?? null,
          previewHealthCheckPath: project.pipelineConfig.previewHealthCheckPath ?? null,
        } satisfies Prisma.InputJsonValue)
      : undefined;

    const fqdn = buildPreviewFqdn(pr.prNumber, projectId, pr.previewBaseDomain);
    const url = `https://${fqdn}/`;

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        environmentId: null,
        status: 'queued',
        trigger: 'pr_preview',
        commitSha: pr.headSha,
        branch: pr.headBranch,
        commitMessage: pr.commitMessage,
        commitAuthor: pr.commitAuthor,
        configSnapshot,
      },
    });

    const preview = await this.prisma.preview.upsert({
      where: { projectId_prNumber: { projectId, prNumber: pr.prNumber } },
      create: {
        projectId,
        deploymentId: deployment.id,
        prNumber: pr.prNumber,
        prBranch: pr.headBranch,
        url,
        gitProvider: pr.gitProvider,
      },
      update: {
        deploymentId: deployment.id,
        prBranch: pr.headBranch,
        url,
      },
    });

    const queue = this.getOrCreateQueue(orgId);
    await queue.add(
      'build',
      {
        deploymentId: deployment.id,
        projectId,
        environmentId: null,
        orgId,
        previewId: preview.id,
      } satisfies BuildJobData,
      { jobId: `deploy-${deployment.id}` },
    );

    return { deployment, previewId: preview.id, deduped: false };
  }

  async getDeploymentLogs(deploymentId: string) {
    return this.prisma.deploymentLog.findMany({
      where: { deploymentId },
      orderBy: { seq: 'asc' },
    });
  }

  async getDeployment(deploymentId: string) {
    const d = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        environment: {
          include: { server: { select: { id: true, name: true, host: true } } },
        },
        project: { select: { id: true, slug: true, name: true, frameworkType: true } },
        triggeredBy: { select: { id: true, name: true } },
        // 勿包含 sizeBytes：Prisma BigInt 无法被 JSON.stringify，会导致详情接口 500、前端无数据
        artifact: { select: { id: true, deploymentId: true, storagePath: true, createdAt: true } },
        approvalRequest: true,
        preview: true,
      },
    });
    if (!d) throw new NotFoundException('部署不存在');
    return d;
  }
}
