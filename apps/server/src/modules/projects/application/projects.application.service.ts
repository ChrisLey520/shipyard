import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { createHmac, randomBytes } from 'crypto';
import { unlink } from 'fs/promises';
import { assertValidProjectSlug, ProjectSlugRuleError } from '../domain/project-slug.rules';
import { PROJECT_REPOSITORY } from './ports/project.repository.port';
import {
  REMOTE_WEBHOOK_REGISTRAR,
  type RemoteWebhookRegistrar,
} from './ports/remote-webhook.registrar.port';
import type { PrismaProjectRepository } from '../infrastructure/prisma-project.repository';

@Injectable()
export class ProjectsApplicationService {
  private readonly logger = new Logger(ProjectsApplicationService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: PrismaProjectRepository,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(REMOTE_WEBHOOK_REGISTRAR) private readonly webhooks: RemoteWebhookRegistrar,
  ) {}

  async listProjects(orgId: string) {
    return this.repo.listProjects(orgId);
  }

  async getProject(orgId: string, projectSlug: string) {
    const project = await this.repo.findProjectWithDetail(orgId, projectSlug);
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
    const existing = await this.repo.findFirstProjectByOrgSlug(orgId, data.slug);
    if (existing) throw new ConflictException('项目 slug 已存在');

    const gitAccount = await this.repo.findGitAccount(orgId, data.gitAccountId);
    if (!gitAccount) throw new NotFoundException('Git 账户不存在');

    const decryptedToken = this.crypto.decrypt(gitAccount.accessToken);
    const webhookSecret = randomBytes(32).toString('hex');

    const project = await this.repo.createProjectWithPipeline({
      organizationId: orgId,
      name: data.name,
      slug: data.slug,
      frameworkType: data.frameworkType,
      repoFullName: data.repoFullName,
      buildCommand: data.buildCommand ?? 'pnpm build',
      outputDir: data.outputDir ?? 'dist',
    });

    const gitConn = await this.repo.createGitConnection({
      projectId: project.id,
      gitProvider: gitAccount.gitProvider,
      baseUrl: gitAccount.baseUrl ?? null,
      accessToken: gitAccount.accessToken,
      gitUsername: gitAccount.gitUsername ?? null,
      webhookSecret,
      gitAccountId: gitAccount.id,
    });

    try {
      const created = await this.webhooks.registerForProvider({
        projectId: project.id,
        gitProvider: gitAccount.gitProvider,
        repoFullName: data.repoFullName,
        accessToken: decryptedToken,
        baseUrl: gitAccount.baseUrl ?? null,
        webhookSecret,
      });
      if (created?.remoteWebhookId) {
        await this.repo.updateGitConnectionRemoteId(gitConn.id, created.remoteWebhookId);
      }
    } catch (err) {
      this.logger.warn(`Webhook 自动注册异常: ${err}`);
    }

    await this.repo.setProjectGitConnectionId(project.id, gitConn.id);

    return this.repo.findProjectCreatedPayload(project.id);
  }

  private static readonly NOTIFICATION_TEMPLATE_MAX = 16_000;

  async updateProject(
    orgId: string,
    projectSlug: string,
    data: {
      name?: string;
      frameworkType?: string;
      slug?: string;
      previewEnabled?: boolean;
      previewServerId?: string | null;
      previewBaseDomain?: string | null;
      notificationMessageTemplate?: string | null;
    },
  ) {
    const project = await this.getProject(orgId, projectSlug);
    const patch: {
      name?: string;
      frameworkType?: string;
      slug?: string;
      previewEnabled?: boolean;
      previewServerId?: string | null;
      previewBaseDomain?: string | null;
      notificationMessageTemplate?: string | null;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.frameworkType !== undefined) patch.frameworkType = data.frameworkType;
    if (data.slug !== undefined) {
      let next: string;
      try {
        next = assertValidProjectSlug(data.slug);
      } catch (e) {
        if (e instanceof ProjectSlugRuleError) {
          throw new BadRequestException(e.message);
        }
        throw e;
      }
      if (next !== project.slug) {
        const taken = await this.repo.findAnotherProjectWithSlug(orgId, next, project.id);
        if (taken) throw new ConflictException('项目 slug 已存在');
      }
      patch.slug = next;
    }
    if (data.previewEnabled !== undefined) patch.previewEnabled = data.previewEnabled;
    if (data.previewBaseDomain !== undefined) {
      patch.previewBaseDomain = data.previewBaseDomain?.trim() || null;
    }
    if (data.previewServerId !== undefined) {
      if (data.previewServerId === null) {
        patch.previewServerId = null;
      } else {
        const srv = await this.prisma.server.findFirst({
          where: { id: data.previewServerId, organizationId: orgId },
        });
        if (!srv) throw new NotFoundException('预览服务器不存在或不属于本组织');
        patch.previewServerId = data.previewServerId;
      }
    }
    if (data.notificationMessageTemplate !== undefined) {
      const raw = data.notificationMessageTemplate;
      if (raw === null || raw.trim() === '') {
        patch.notificationMessageTemplate = null;
      } else {
        const t = raw.trim();
        if (t.length > ProjectsApplicationService.NOTIFICATION_TEMPLATE_MAX) {
          throw new BadRequestException(
            `通知消息模板过长（上限 ${ProjectsApplicationService.NOTIFICATION_TEMPLATE_MAX} 字符）`,
          );
        }
        patch.notificationMessageTemplate = t;
      }
    }
    if (Object.keys(patch).length === 0) return project;

    const updated = await this.repo.updateProjectById(project.id, patch);

    const previewTouched =
      data.previewEnabled !== undefined ||
      data.previewServerId !== undefined ||
      data.previewBaseDomain !== undefined;
    if (previewTouched) {
      const meta = await this.repo.findGitConnectionWebhookMeta(project.id);
      if (meta?.remoteWebhookId && meta.gitProvider === 'github') {
        try {
          const token = this.crypto.decrypt(meta.accessToken);
          const webhookSecret = this.crypto.decrypt(meta.webhookSecret);
          await this.webhooks.registerForProvider({
            projectId: project.id,
            gitProvider: meta.gitProvider,
            repoFullName: project.repoFullName,
            accessToken: token,
            baseUrl: meta.baseUrl ?? null,
            webhookSecret,
          });
        } catch (err) {
          this.logger.warn(`预览设置变更后 Webhook 修复失败: ${err}`);
        }
      }
    }

    return updated;
  }

  async deleteProject(orgId: string, projectSlug: string) {
    const project = await this.getProject(orgId, projectSlug);

    try {
      const gitConn = await this.repo.findGitConnectionWebhookMeta(project.id);
      if (gitConn?.remoteWebhookId) {
        const token = this.crypto.decrypt(gitConn.accessToken);
        await this.webhooks.unregisterForProvider({
          gitProvider: gitConn.gitProvider,
          repoFullName: project.repoFullName,
          accessToken: token,
          baseUrl: gitConn.baseUrl ?? null,
          remoteWebhookId: gitConn.remoteWebhookId,
        });
      }
    } catch (err) {
      this.logger.warn(`Webhook 自动注销异常: ${err}`);
    }

    await this.repo.deleteProjectById(project.id);
  }

  async updatePipelineConfig(
    orgId: string,
    projectSlug: string,
    data: {
      installCommand?: string;
      buildCommand?: string;
      lintCommand?: string | null;
      testCommand?: string | null;
      outputDir?: string;
      nodeVersion?: string;
      cacheEnabled?: boolean;
      timeoutSeconds?: number;
      ssrEntryPoint?: string | null;
      previewHealthCheckPath?: string | null;
      containerImageEnabled?: boolean;
      containerImageName?: string | null;
      containerRegistryAuth?: { username?: string; password?: string } | null;
    },
  ) {
    const project = await this.getProject(orgId, projectSlug);
    if (data.previewHealthCheckPath != null && data.previewHealthCheckPath.trim() !== '') {
      const p = data.previewHealthCheckPath.trim();
      const withSlash = p.startsWith('/') ? p : `/${p}`;
      if (!/^[/a-zA-Z0-9._~-]+$/.test(withSlash)) {
        throw new BadRequestException('previewHealthCheckPath 仅允许字母数字及 / . _ - ~');
      }
      data = { ...data, previewHealthCheckPath: withSlash };
    } else if (data.previewHealthCheckPath === '' || data.previewHealthCheckPath === null) {
      data = { ...data, previewHealthCheckPath: null };
    }

    const { containerRegistryAuth, ...rest } = data;
    const updatePayload: Parameters<typeof this.repo.updatePipelineConfigByProjectId>[1] = { ...rest };
    if (containerRegistryAuth !== undefined) {
      updatePayload.containerRegistryAuthEncrypted =
        containerRegistryAuth === null
          ? null
          : this.crypto.encrypt(JSON.stringify(containerRegistryAuth));
    }
    return this.repo.updatePipelineConfigByProjectId(project.id, updatePayload);
  }

  async getDeployments(orgId: string, projectSlug: string, environmentId?: string) {
    const project = await this.getProject(orgId, projectSlug);
    return this.repo.findDeploymentsForProject(project.id, environmentId);
  }

  async deleteDeployment(orgId: string, projectSlug: string, deploymentId: string) {
    const project = await this.getProject(orgId, projectSlug);

    const d = await this.repo.findDeploymentWithArtifact(project.id, deploymentId);
    if (!d) throw new NotFoundException('部署不存在');

    const artifactId = d.artifact?.id ?? null;
    const artifactPath = d.artifact?.storagePath ?? null;

    await this.repo.runDeleteDeploymentTransaction(project.id, d.id, artifactId);

    if (artifactPath) {
      await unlink(artifactPath).catch(() => undefined);
    }
  }

  async bulkDeleteDeployments(orgId: string, projectSlug: string, ids: string[]) {
    const project = await this.getProject(orgId, projectSlug);
    const uniq = Array.from(new Set(ids.map((s) => s.trim()).filter(Boolean)));
    if (uniq.length === 0) return { deleted: 0 };

    const deployments = await this.repo.findDeploymentsByIds(project.id, uniq);

    const artifactIds = Array.from(
      new Set(deployments.map((dep) => dep.artifact?.id).filter((x): x is string => Boolean(x))),
    );
    const artifactPaths = deployments
      .map((dep) => dep.artifact?.storagePath)
      .filter((p): p is string => Boolean(p));

    const deleted = await this.repo.runBulkDeleteDeploymentsTransaction(project.id, uniq, artifactIds);

    await Promise.all(artifactPaths.map((p) => unlink(p).catch(() => undefined)));
    return { deleted };
  }

  async clearDeployments(orgId: string, projectSlug: string, environmentId?: string) {
    const project = await this.getProject(orgId, projectSlug);

    const rows = await this.repo.findAllDeploymentIdsForProject(project.id, environmentId);
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { deleted: 0 };

    return this.bulkDeleteDeployments(orgId, projectSlug, ids);
  }

  verifyWebhookSignature(secret: string, payload: string, signature: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    return signature === expected;
  }

  async listProjectBuildEnvVars(orgId: string, projectSlug: string) {
    const project = await this.getProject(orgId, projectSlug);
    return this.repo.listProjectBuildEnvVars(project.id);
  }

  async upsertProjectBuildEnvVar(orgId: string, projectSlug: string, key: string, value: string) {
    const project = await this.getProject(orgId, projectSlug);
    const encrypted = this.crypto.encrypt(value);
    return this.repo.upsertProjectBuildEnvVar(project.id, key, encrypted);
  }

  async deleteProjectBuildEnvVar(orgId: string, projectSlug: string, varId: string) {
    const project = await this.getProject(orgId, projectSlug);
    await this.repo.deleteProjectBuildEnvVar(project.id, varId);
  }
}
