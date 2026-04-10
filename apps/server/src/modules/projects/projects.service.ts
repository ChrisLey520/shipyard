import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { createHmac, randomBytes } from 'crypto';
import { unlink } from 'fs/promises';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private getServerPublicUrl(): string | null {
    const url = process.env['SERVER_PUBLIC_URL']?.trim();
    if (!url) return null;
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private getGithubWebhookCallbackUrl(): string | null {
    const base = this.getServerPublicUrl();
    if (!base) return null;
    return `${base}/api/webhooks/github`;
  }

  private async registerGithubWebhook(opts: {
    repoFullName: string;
    accessToken: string;
    webhookSecret: string;
  }): Promise<{ remoteWebhookId: string } | null> {
    const callbackUrl = this.getGithubWebhookCallbackUrl();
    if (!callbackUrl) {
      this.logger.warn('SERVER_PUBLIC_URL 未配置，跳过 GitHub Webhook 自动注册');
      return null;
    }

    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) {
      this.logger.warn(`repoFullName 非法: ${opts.repoFullName}`);
      return null;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `token ${opts.accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: callbackUrl,
          content_type: 'json',
          secret: opts.webhookSecret,
          insecure_ssl: '0',
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitHub Webhook 注册失败 HTTP ${res.status}: ${text}`);
      return null;
    }

    const json = (await res.json()) as { id?: number };
    if (!json.id) return null;
    return { remoteWebhookId: String(json.id) };
  }

  private async unregisterGithubWebhook(opts: {
    repoFullName: string;
    accessToken: string;
    remoteWebhookId: string;
  }): Promise<void> {
    const [owner, repo] = opts.repoFullName.split('/');
    if (!owner || !repo) return;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${opts.remoteWebhookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${opts.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`GitHub Webhook 注销失败 HTTP ${res.status}: ${text}`);
    }
  }

  async listProjects(orgId: string) {
    return this.prisma.project.findMany({
      where: { organizationId: orgId },
      include: {
        pipelineConfig: { select: { buildCommand: true, outputDir: true, nodeVersion: true } },
        environments: { select: { id: true, name: true } },
        _count: { select: { deployments: true } },
      },
    });
  }

  async getProject(orgId: string, projectSlug: string) {
    const project = await this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: projectSlug },
      include: {
        gitConnection: { select: { id: true, gitProvider: true, gitUsername: true, createdAt: true, updatedAt: true } },
        pipelineConfig: true,
        environments: {
          include: { server: { select: { id: true, name: true, host: true, os: true } } },
        },
        _count: { select: { deployments: true, environments: true } },
      },
    });
    if (!project) throw new NotFoundException('项目不存在');
    return project;
  }

  async createProject(
    orgId: string,
    data: {
      name: string;
      slug: string;
      frameworkType: string;
      repoFullName: string;
      gitAccountId: string;
      buildCommand?: string;
      outputDir?: string;
    },
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: data.slug },
    });
    if (existing) throw new ConflictException('项目 slug 已存在');

    const gitAccount = await this.prisma.gitAccount.findFirst({
      where: { id: data.gitAccountId, organizationId: orgId },
    });
    if (!gitAccount) throw new NotFoundException('Git 账户不存在');

    const decryptedToken = this.crypto.decrypt(gitAccount.accessToken);
    const webhookSecret = randomBytes(32).toString('hex');

    // 先创建 Project（gitConnectionId 暂为 null）
    const project = await this.prisma.project.create({
      data: {
        organizationId: orgId,
        name: data.name,
        slug: data.slug,
        frameworkType: data.frameworkType,
        repoFullName: data.repoFullName,
        pipelineConfig: {
          create: {
            buildCommand: data.buildCommand ?? 'pnpm build',
            outputDir: data.outputDir ?? 'dist',
          },
        },
      },
    });

    // 创建 GitConnection
    const gitConn = await this.prisma.gitConnection.create({
      data: {
        projectId: project.id,
        gitProvider: gitAccount.gitProvider,
        baseUrl: gitAccount.baseUrl ?? null,
        accessToken: gitAccount.accessToken, // 直接复用已加密 token（BuildWorker 会解密）
        gitUsername: gitAccount.gitUsername ?? null,
        webhookSecret,
      },
    });

    // Phase 2：Webhook 自动注册（目前仅 GitHub）
    if (gitAccount.gitProvider === 'github') {
      try {
        const created = await this.registerGithubWebhook({
          repoFullName: data.repoFullName,
          accessToken: decryptedToken,
          webhookSecret,
        });
        if (created?.remoteWebhookId) {
          await this.prisma.gitConnection.update({
            where: { id: gitConn.id },
            data: { remoteWebhookId: created.remoteWebhookId },
          });
        }
      } catch (err) {
        this.logger.warn(`GitHub Webhook 自动注册异常: ${err}`);
      }
    }

    // 回填 gitConnectionId
    await this.prisma.project.update({
      where: { id: project.id },
      data: { gitConnectionId: gitConn.id },
    });

    return this.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { pipelineConfig: true, gitConnection: { select: { id: true, gitProvider: true } } },
    });
  }

  async updateProject(
    orgId: string,
    projectSlug: string,
    data: { name?: string; frameworkType?: string; slug?: string },
  ) {
    const project = await this.getProject(orgId, projectSlug);
    const patch: { name?: string; frameworkType?: string; slug?: string } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.frameworkType !== undefined) patch.frameworkType = data.frameworkType;
    if (data.slug !== undefined) {
      const next = data.slug.trim();
      if (next.length < 1 || next.length > 64 || !/^[a-z0-9-]+$/.test(next)) {
        throw new BadRequestException('URL 标识仅允许小写字母、数字和连字符，长度 1–64');
      }
      if (next !== project.slug) {
        const taken = await this.prisma.project.findFirst({
          where: { organizationId: orgId, slug: next, id: { not: project.id } },
        });
        if (taken) throw new ConflictException('项目 slug 已存在');
      }
      patch.slug = next;
    }
    if (Object.keys(patch).length === 0) return project;
    return this.prisma.project.update({ where: { id: project.id }, data: patch });
  }

  async deleteProject(orgId: string, projectSlug: string) {
    const project = await this.getProject(orgId, projectSlug);

    // Phase 2：Webhook 自动注销（目前仅 GitHub）
    try {
      const gitConn = await this.prisma.gitConnection.findUnique({
        where: { projectId: project.id },
        select: { gitProvider: true, accessToken: true, remoteWebhookId: true },
      });
      if (gitConn?.gitProvider === 'github' && gitConn.remoteWebhookId) {
        const token = this.crypto.decrypt(gitConn.accessToken);
        await this.unregisterGithubWebhook({
          repoFullName: project.repoFullName,
          accessToken: token,
          remoteWebhookId: gitConn.remoteWebhookId,
        });
      }
    } catch (err) {
      this.logger.warn(`GitHub Webhook 自动注销异常: ${err}`);
    }

    await this.prisma.project.delete({ where: { id: project.id } });
  }

  async updatePipelineConfig(
    orgId: string,
    projectSlug: string,
    data: {
      installCommand?: string;
      buildCommand?: string;
      lintCommand?: string;
      testCommand?: string;
      outputDir?: string;
      nodeVersion?: string;
      cacheEnabled?: boolean;
      timeoutSeconds?: number;
      ssrEntryPoint?: string;
    },
  ) {
    const project = await this.getProject(orgId, projectSlug);
    return this.prisma.pipelineConfig.update({
      where: { projectId: project.id },
      data,
    });
  }

  async getDeployments(orgId: string, projectSlug: string, environmentId?: string) {
    const project = await this.getProject(orgId, projectSlug);
    return this.prisma.deployment.findMany({
      where: {
        projectId: project.id,
        ...(environmentId ? { environmentId } : {}),
      },
      include: {
        environment: { select: { id: true, name: true } },
        triggeredBy: { select: { id: true, name: true } },
        artifact: { select: { id: true, storagePath: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async deleteDeployment(orgId: string, projectSlug: string, deploymentId: string) {
    const project = await this.getProject(orgId, projectSlug);

    const d = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId: project.id },
      include: { artifact: { select: { id: true, storagePath: true } } },
    });
    if (!d) throw new NotFoundException('部署不存在');

    const artifactId = d.artifact?.id ?? null;
    const artifactPath = d.artifact?.storagePath ?? null;

    await this.prisma.$transaction(async (tx) => {
      // 若该产物被其他 Deployment 引用，则先解除引用，避免出现悬挂 artifactId
      if (artifactId) {
        await tx.deployment.updateMany({
          where: {
            projectId: project.id,
            artifactId,
            id: { not: d.id },
          },
          data: { artifactId: null },
        });
      }
      await tx.deployment.delete({ where: { id: d.id } });
    });

    if (artifactPath) {
      await unlink(artifactPath).catch(() => undefined);
    }
  }

  async bulkDeleteDeployments(orgId: string, projectSlug: string, ids: string[]) {
    const project = await this.getProject(orgId, projectSlug);
    const uniq = Array.from(new Set(ids.map((s) => s.trim()).filter(Boolean)));
    if (uniq.length === 0) return { deleted: 0 };

    const deployments = await this.prisma.deployment.findMany({
      where: { projectId: project.id, id: { in: uniq } },
      include: { artifact: { select: { id: true, storagePath: true } } },
    });

    const artifactIds = Array.from(
      new Set(deployments.map((d) => d.artifact?.id).filter((x): x is string => Boolean(x))),
    );
    const artifactPaths = deployments
      .map((d) => d.artifact?.storagePath)
      .filter((p): p is string => Boolean(p));

    const deleted = await this.prisma.$transaction(async (tx) => {
      if (artifactIds.length) {
        await tx.deployment.updateMany({
          where: { projectId: project.id, artifactId: { in: artifactIds }, id: { notIn: uniq } },
          data: { artifactId: null },
        });
      }
      const res = await tx.deployment.deleteMany({
        where: { projectId: project.id, id: { in: uniq } },
      });
      return res.count;
    });

    await Promise.all(artifactPaths.map((p) => unlink(p).catch(() => undefined)));
    return { deleted };
  }

  async clearDeployments(orgId: string, projectSlug: string, environmentId?: string) {
    const project = await this.getProject(orgId, projectSlug);

    const deployments = await this.prisma.deployment.findMany({
      where: {
        projectId: project.id,
        ...(environmentId ? { environmentId } : {}),
      },
      include: { artifact: { select: { id: true, storagePath: true } } },
    });

    const ids = deployments.map((d) => d.id);
    if (ids.length === 0) return { deleted: 0 };

    return this.bulkDeleteDeployments(orgId, projectSlug, ids);
  }

  /**
   * 验证 Webhook Secret HMAC（供 WebhooksModule 使用）
   */
  verifyWebhookSignature(secret: string, payload: string, signature: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    return signature === expected;
  }

  // ─── 项目级构建环境变量（Build-time env） ──────────────────────────────────

  async listProjectBuildEnvVars(orgId: string, projectSlug: string) {
    const project = await this.getProject(orgId, projectSlug);
    const vars = await this.prisma.projectBuildEnvVariable.findMany({
      where: { projectId: project.id },
      select: { id: true, key: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    return vars;
  }

  async upsertProjectBuildEnvVar(orgId: string, projectSlug: string, key: string, value: string) {
    const project = await this.getProject(orgId, projectSlug);
    const encrypted = this.crypto.encrypt(value);
    return this.prisma.projectBuildEnvVariable.upsert({
      where: { projectId_key: { projectId: project.id, key } },
      create: { projectId: project.id, key, value: encrypted },
      update: { value: encrypted },
      select: { id: true, key: true, updatedAt: true },
    });
  }

  async deleteProjectBuildEnvVar(orgId: string, projectSlug: string, varId: string) {
    const project = await this.getProject(orgId, projectSlug);
    await this.prisma.projectBuildEnvVariable.deleteMany({
      where: { id: varId, projectId: project.id },
    });
  }
}
