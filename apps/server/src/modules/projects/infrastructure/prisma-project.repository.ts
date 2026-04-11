import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class PrismaProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  listProjects(orgId: string) {
    return this.prisma.project.findMany({
      where: { organizationId: orgId },
      include: {
        pipelineConfig: { select: { buildCommand: true, outputDir: true, nodeVersion: true } },
        environments: { select: { id: true, name: true } },
        _count: { select: { deployments: true } },
      },
    });
  }

  findProjectWithDetail(orgId: string, projectSlug: string) {
    return this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: projectSlug },
      include: {
        gitConnection: { select: { id: true, gitProvider: true, gitUsername: true, createdAt: true, updatedAt: true } },
        pipelineConfig: true,
        previewServer: { select: { id: true, name: true, host: true, os: true } },
        environments: {
          include: { server: { select: { id: true, name: true, host: true, os: true } } },
        },
        _count: { select: { deployments: true, environments: true } },
      },
    });
  }

  findFirstProjectByOrgSlug(orgId: string, slug: string) {
    return this.prisma.project.findFirst({
      where: { organizationId: orgId, slug },
    });
  }

  findGitAccount(orgId: string, gitAccountId: string) {
    return this.prisma.gitAccount.findFirst({
      where: { id: gitAccountId, organizationId: orgId },
    });
  }

  createProjectWithPipeline(data: {
    organizationId: string;
    name: string;
    slug: string;
    frameworkType: string;
    repoFullName: string;
    buildCommand: string;
    outputDir: string;
  }) {
    return this.prisma.project.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
        frameworkType: data.frameworkType,
        repoFullName: data.repoFullName,
        pipelineConfig: {
          create: {
            buildCommand: data.buildCommand,
            outputDir: data.outputDir,
          },
        },
      },
    });
  }

  createGitConnection(data: {
    projectId: string;
    gitProvider: string;
    baseUrl: string | null;
    accessToken: string;
    gitUsername: string | null;
    webhookSecret: string;
    gitAccountId: string;
  }) {
    return this.prisma.gitConnection.create({ data });
  }

  updateGitConnectionRemoteId(gitConnectionId: string, remoteWebhookId: string) {
    return this.prisma.gitConnection.update({
      where: { id: gitConnectionId },
      data: { remoteWebhookId },
    });
  }

  setProjectGitConnectionId(projectId: string, gitConnectionId: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { gitConnectionId },
    });
  }

  findProjectCreatedPayload(projectId: string) {
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { pipelineConfig: true, gitConnection: { select: { id: true, gitProvider: true } } },
    });
  }

  updateProjectById(
    projectId: string,
    data: {
      name?: string;
      frameworkType?: string;
      slug?: string;
      previewEnabled?: boolean;
      previewServerId?: string | null;
      previewBaseDomain?: string | null;
    },
  ) {
    return this.prisma.project.update({ where: { id: projectId }, data });
  }

  findAnotherProjectWithSlug(orgId: string, slug: string, excludeProjectId: string) {
    return this.prisma.project.findFirst({
      where: { organizationId: orgId, slug, id: { not: excludeProjectId } },
    });
  }

  deleteProjectById(projectId: string) {
    return this.prisma.project.delete({ where: { id: projectId } });
  }

  findGitConnectionWebhookMeta(projectId: string) {
    return this.prisma.gitConnection.findUnique({
      where: { projectId },
      select: {
        gitProvider: true,
        accessToken: true,
        baseUrl: true,
        remoteWebhookId: true,
        webhookSecret: true,
      },
    });
  }

  updatePipelineConfigByProjectId(
    projectId: string,
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
    },
  ) {
    return this.prisma.pipelineConfig.update({
      where: { projectId },
      data,
    });
  }

  findDeploymentsForProject(projectId: string, environmentId?: string) {
    return this.prisma.deployment.findMany({
      where: {
        projectId,
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

  findDeploymentWithArtifact(projectId: string, deploymentId: string) {
    return this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId },
      include: { artifact: { select: { id: true, storagePath: true } } },
    });
  }

  async runDeleteDeploymentTransaction(
    projectId: string,
    deploymentId: string,
    artifactId: string | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      if (artifactId) {
        await tx.deployment.updateMany({
          where: {
            projectId,
            artifactId,
            id: { not: deploymentId },
          },
          data: { artifactId: null },
        });
      }
      await tx.deployment.delete({ where: { id: deploymentId } });
    });
  }

  findDeploymentsByIds(projectId: string, ids: string[]) {
    return this.prisma.deployment.findMany({
      where: { projectId, id: { in: ids } },
      include: { artifact: { select: { id: true, storagePath: true } } },
    });
  }

  async runBulkDeleteDeploymentsTransaction(projectId: string, uniqIds: string[], artifactIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      if (artifactIds.length) {
        await tx.deployment.updateMany({
          where: { projectId, artifactId: { in: artifactIds }, id: { notIn: uniqIds } },
          data: { artifactId: null },
        });
      }
      const res = await tx.deployment.deleteMany({
        where: { projectId, id: { in: uniqIds } },
      });
      return res.count;
    });
  }

  findAllDeploymentIdsForProject(projectId: string, environmentId?: string) {
    return this.prisma.deployment.findMany({
      where: {
        projectId,
        ...(environmentId ? { environmentId } : {}),
      },
      select: { id: true },
    });
  }

  listProjectBuildEnvVars(projectId: string) {
    return this.prisma.projectBuildEnvVariable.findMany({
      where: { projectId },
      select: { id: true, key: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  upsertProjectBuildEnvVar(projectId: string, key: string, encryptedValue: string) {
    return this.prisma.projectBuildEnvVariable.upsert({
      where: { projectId_key: { projectId, key } },
      create: { projectId, key, value: encryptedValue },
      update: { value: encryptedValue },
      select: { id: true, key: true, updatedAt: true },
    });
  }

  deleteProjectBuildEnvVar(projectId: string, varId: string) {
    return this.prisma.projectBuildEnvVariable.deleteMany({
      where: { id: varId, projectId },
    });
  }
}
