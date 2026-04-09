import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async listEnvironments(projectId: string) {
    return this.prisma.environment.findMany({
      where: { projectId },
      include: { server: { select: { id: true, name: true, host: true } } },
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

    return this.prisma.environment.create({
      data: { projectId, ...data },
    });
  }

  async updateEnvironment(envId: string, projectId: string, data: Partial<{
    name: string;
    triggerBranch: string;
    serverId: string;
    deployPath: string;
    domain: string;
    healthCheckUrl: string;
    protected: boolean;
  }>) {
    await this.getEnv(envId, projectId);
    return this.prisma.environment.update({ where: { id: envId }, data });
  }

  async deleteEnvironment(envId: string, projectId: string) {
    await this.getEnv(envId, projectId);
    await this.prisma.environment.delete({ where: { id: envId } });
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
