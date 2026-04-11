import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { normalizeHttpRootUrlWithSlash, resolveDeployAccessHost } from '@shipyard/shared';

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
      include: { server: { select: { id: true, name: true, host: true, os: true } } },
    });
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
    },
  ) {
    // 验证 server 属于同一组织
    const server = await this.prisma.server.findFirst({
      where: { id: data.serverId, organizationId: orgId },
    });
    if (!server) throw new ForbiddenException('服务器不存在或不属于当前组织');

    const accessUrl = this.computeAccessUrl(data.domain, server.host);
    return this.prisma.environment.create({
      data: { projectId, ...data, accessUrl },
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
    if (payload['domain'] === '') payload['domain'] = null;
    if (payload['healthCheckUrl'] === '') payload['healthCheckUrl'] = null;

    // 如果 domain / server 发生变更，则重置 accessUrl 为“环境域名推导的初始值”
    const nextServerId = (payload['serverId'] as string | undefined) ?? undefined;
    const domainChanged = Object.prototype.hasOwnProperty.call(payload, 'domain');
    const serverChanged = nextServerId !== undefined && nextServerId !== current.serverId;
    if (domainChanged || serverChanged) {
      const serverId = nextServerId ?? current.serverId;
      const server = await this.prisma.server.findUnique({ where: { id: serverId }, select: { host: true } });
      const nextDomain = (payload['domain'] as string | null | undefined) ?? current.domain ?? null;
      payload['accessUrl'] = server ? this.computeAccessUrl(nextDomain, server.host) : null;
    }

    return this.prisma.environment.update({
      where: { id: envId },
      data: payload as Prisma.EnvironmentUpdateInput,
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
