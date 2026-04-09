import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { createHmac, randomBytes } from 'crypto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

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
          include: { server: { select: { id: true, name: true, host: true } } },
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
      gitProvider: string;
      accessToken: string;
      gitUsername?: string;
      buildCommand?: string;
      outputDir?: string;
    },
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: data.slug },
    });
    if (existing) throw new ConflictException('项目 slug 已存在');

    const encryptedToken = this.crypto.encrypt(data.accessToken);
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
        gitProvider: data.gitProvider,
        accessToken: encryptedToken,
        gitUsername: data.gitUsername ?? null,
        webhookSecret,
      },
    });

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
    data: { name?: string; frameworkType?: string },
  ) {
    const project = await this.getProject(orgId, projectSlug);
    return this.prisma.project.update({ where: { id: project.id }, data });
  }

  async deleteProject(orgId: string, projectSlug: string) {
    const project = await this.getProject(orgId, projectSlug);
    // TODO: 调用 Git 平台 API 注销 Webhook（Phase 2）
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

  /**
   * 验证 Webhook Secret HMAC（供 WebhooksModule 使用）
   */
  verifyWebhookSignature(secret: string, payload: string, signature: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    return signature === expected;
  }
}
