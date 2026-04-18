import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { normalizeHttpRootUrlWithSlash, resolveDeployAccessHost } from '@shipyard/shared';
import { validateAndNormalizeReleaseConfig } from './release-config.validation';

@Injectable()
export class EnvironmentsApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private computeAccessUrl(domain: string | null | undefined, serverHost: string): string | null {
    const d = domain?.trim() ?? '';
    if (!d) return null;
    const host = resolveDeployAccessHost(d, serverHost);
    if (!host) return null;
    return normalizeHttpRootUrlWithSlash(host) || null;
  }

  async listEnvironments(projectId: string) {
    return this.prisma.environment.findMany({
      where: { projectId },
      include: {
        server: { select: { id: true, name: true, host: true, os: true } },
        environmentServers: {
          orderBy: { sortOrder: 'asc' },
          include: { server: { select: { id: true, name: true, host: true, os: true } } },
        },
      },
    });
  }

  /** 部署目标顺序列表；缺省为单台 primaryServerId */
  private normalizeTargetRows(
    primaryServerId: string,
    environmentTargets?: Array<{ serverId: string; sortOrder?: number; weight?: number }>,
  ): Array<{ serverId: string; sortOrder: number; weight: number }> {
    if (!environmentTargets?.length) {
      return [{ serverId: primaryServerId, sortOrder: 0, weight: 100 }];
    }
    const sorted = [...environmentTargets].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    return sorted.map((t, i) => ({
      serverId: t.serverId,
      sortOrder: t.sortOrder ?? i,
      weight: t.weight ?? 100,
    }));
  }

  private async assertServersInOrg(orgId: string, serverIds: string[]): Promise<void> {
    const uniq = [...new Set(serverIds)];
    const n = await this.prisma.server.count({
      where: { organizationId: orgId, id: { in: uniq } },
    });
    if (n !== uniq.length) {
      throw new BadRequestException('存在无效或不属于当前组织的服务器');
    }
  }

  private async replaceEnvironmentServers(
    tx: Prisma.TransactionClient,
    environmentId: string,
    rows: Array<{ serverId: string; sortOrder: number; weight: number }>,
  ): Promise<void> {
    await tx.environmentServer.deleteMany({ where: { environmentId } });
    for (const r of rows) {
      await tx.environmentServer.create({
        data: {
          id: randomUUID(),
          environmentId,
          serverId: r.serverId,
          sortOrder: r.sortOrder,
          weight: r.weight,
        },
      });
    }
  }

  async createEnvironment(
    projectId: string,
    orgId: string,
    data: {
      name: string;
      triggerBranch: string;
      serverId: string;
      deployPath: string;
      domain?: string;
      healthCheckUrl?: string;
      protected?: boolean;
      releaseConfig?: unknown;
      environmentTargets?: Array<{ serverId: string; sortOrder?: number; weight?: number }>;
    },
  ) {
    const rows = this.normalizeTargetRows(data.serverId, data.environmentTargets);
    if (rows[0]!.serverId !== data.serverId) {
      throw new BadRequestException('environmentTargets 首项 serverId 须与主服务器 serverId 一致');
    }
    await this.assertServersInOrg(
      orgId,
      rows.map((r) => r.serverId),
    );

    const releaseParsed = await validateAndNormalizeReleaseConfig(
      this.prisma,
      orgId,
      data.releaseConfig,
    );

    const primary = await this.prisma.server.findFirstOrThrow({
      where: { id: data.serverId, organizationId: orgId },
    });
    const accessUrl = this.computeAccessUrl(data.domain, primary.host);

    const rcValue =
      releaseParsed === undefined
        ? undefined
        : (releaseParsed === null ? Prisma.JsonNull : (releaseParsed as unknown as Prisma.InputJsonValue));

    return this.prisma.$transaction(async (tx) => {
      const env = await tx.environment.create({
        data: {
          projectId,
          name: data.name,
          triggerBranch: data.triggerBranch,
          serverId: data.serverId,
          deployPath: data.deployPath,
          domain: data.domain,
          healthCheckUrl: data.healthCheckUrl,
          protected: data.protected ?? false,
          accessUrl,
          ...(rcValue !== undefined ? { releaseConfig: rcValue } : {}),
        },
      });
      await this.replaceEnvironmentServers(tx, env.id, rows);
      return tx.environment.findUniqueOrThrow({
        where: { id: env.id },
        include: {
          server: { select: { id: true, name: true, host: true, os: true } },
          environmentServers: {
            orderBy: { sortOrder: 'asc' },
            include: { server: { select: { id: true, name: true, host: true, os: true } } },
          },
        },
      });
    });
  }

  async updateEnvironment(
    envId: string,
    projectId: string,
    orgId: string,
    data: Partial<{
      name: string;
      triggerBranch: string;
      serverId: string;
      deployPath: string;
      domain: string | null;
      healthCheckUrl: string | null;
      protected: boolean;
      releaseConfig: unknown;
      environmentTargets: Array<{ serverId: string; sortOrder?: number; weight?: number }>;
    }>,
  ) {
    const current = await this.getEnv(envId, projectId);
    if (data.serverId !== undefined) {
      const server = await this.prisma.server.findFirst({
        where: { id: data.serverId, organizationId: orgId },
      });
      if (!server) throw new ForbiddenException('服务器不存在或不属于当前组织');
    }

    const payload: Record<string, unknown> = { ...data };
    delete payload['environmentTargets'];
    delete payload['releaseConfig'];
    if (payload['domain'] === '') payload['domain'] = null;
    if (payload['healthCheckUrl'] === '') payload['healthCheckUrl'] = null;

    const releaseParsed = await validateAndNormalizeReleaseConfig(
      this.prisma,
      orgId,
      data.releaseConfig,
    );
    if (data.releaseConfig !== undefined) {
      payload['releaseConfig'] =
        releaseParsed === null
          ? Prisma.JsonNull
          : releaseParsed === undefined
            ? undefined
            : (releaseParsed as unknown as Prisma.InputJsonValue);
    }

    let nextPrimary = (payload['serverId'] as string | undefined) ?? current.serverId;
    if (data.environmentTargets !== undefined) {
      const rows = this.normalizeTargetRows(nextPrimary, data.environmentTargets);
      if (data.serverId !== undefined && rows[0]!.serverId !== data.serverId) {
        throw new BadRequestException('environmentTargets 首项 serverId 须与主服务器 serverId 一致');
      }
      nextPrimary = rows[0]!.serverId;
      payload['serverId'] = nextPrimary;
      await this.assertServersInOrg(
        orgId,
        rows.map((r) => r.serverId),
      );
    } else if (data.serverId !== undefined) {
      await this.assertServersInOrg(orgId, [data.serverId]);
    }

    // 如果 domain / server 发生变更，则重置 accessUrl 为“环境域名推导的初始值”
    const nextServerId = (payload['serverId'] as string | undefined) ?? current.serverId;
    const domainChanged = Object.prototype.hasOwnProperty.call(data, 'domain');
    const serverChanged = nextServerId !== current.serverId;
    if (domainChanged || serverChanged) {
      const server = await this.prisma.server.findUnique({
        where: { id: nextServerId },
        select: { host: true },
      });
      const nextDomain = (payload['domain'] as string | null | undefined) ?? current.domain ?? null;
      payload['accessUrl'] = server ? this.computeAccessUrl(nextDomain, server.host) : null;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.environment.update({
        where: { id: envId },
        data: payload as Prisma.EnvironmentUpdateInput,
      });
      if (data.environmentTargets !== undefined) {
        const rows = this.normalizeTargetRows(
          (payload['serverId'] as string) ?? current.serverId,
          data.environmentTargets,
        );
        await this.replaceEnvironmentServers(tx, envId, rows);
      } else if (data.serverId !== undefined) {
        await this.replaceEnvironmentServers(tx, envId, [
          { serverId: data.serverId, sortOrder: 0, weight: 100 },
        ]);
      }
      return tx.environment.findUniqueOrThrow({
        where: { id: envId },
        include: {
          server: { select: { id: true, name: true, host: true, os: true } },
          environmentServers: {
            orderBy: { sortOrder: 'asc' },
            include: { server: { select: { id: true, name: true, host: true, os: true } } },
          },
        },
      });
    });
  }

  async deleteEnvironment(envId: string, projectId: string) {
    await this.getEnv(envId, projectId);
    await this.prisma.environment.delete({ where: { id: envId } });
  }

  /**
   * 返回各环境最近一次成功部署的访问地址（优先部署成功后计算出来的地址，而不是环境填写的域名）
   * - 若部署时写入了 shipyardAccess（macOS PM2 静态回退），优先返回该地址
   * - 否则返回 resolveDeployAccessHost(domain, serverHost) 计算后的 http(s) URL
   * - 若不存在成功部署或无法推导，返回 null
   */
  async getEnvironmentAccessUrls(projectId: string): Promise<Record<string, string | null>> {
    const envs = await this.prisma.environment.findMany({
      where: { projectId },
      select: { id: true, accessUrl: true },
      orderBy: { createdAt: 'asc' },
    });
    return Object.fromEntries(envs.map((e) => [e.id, e.accessUrl ?? null]));
  }

  // ─── 环境变量 ─────────────────────────────────────────────────────────────

  async listEnvVars(envId: string, projectId: string) {
    await this.getEnv(envId, projectId);
    const vars = await this.prisma.envVariable.findMany({ where: { environmentId: envId } });
    // 返回 key 列表（不返回明文值）
    return vars.map((v) => ({ id: v.id, key: v.key, updatedAt: v.updatedAt }));
  }

  async upsertEnvVar(envId: string, projectId: string, key: string, value: string) {
    await this.getEnv(envId, projectId);
    const encrypted = this.crypto.encrypt(value);
    return this.prisma.envVariable.upsert({
      where: { environmentId_key: { environmentId: envId, key } },
      create: { environmentId: envId, key, value: encrypted },
      update: { value: encrypted },
      select: { id: true, key: true, updatedAt: true },
    });
  }

  async deleteEnvVar(envId: string, projectId: string, varId: string) {
    await this.getEnv(envId, projectId);
    await this.prisma.envVariable.deleteMany({ where: { id: varId, environmentId: envId } });
  }

  /**
   * 解密所有环境变量（Worker 内部使用）
   */
  async getDecryptedEnvVars(envId: string): Promise<Record<string, string>> {
    const vars = await this.prisma.envVariable.findMany({ where: { environmentId: envId } });
    const result: Record<string, string> = {};
    for (const v of vars) {
      result[v.key] = this.crypto.decrypt(v.value);
    }
    return result;
  }

  private async getEnv(envId: string, projectId: string) {
    const env = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
    });
    if (!env) throw new NotFoundException('环境不存在');
    return env;
  }
}
