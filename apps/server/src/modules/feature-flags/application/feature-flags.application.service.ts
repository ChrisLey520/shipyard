import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9._-]{0,127}$/;

const flagRowSelect = {
  id: true,
  key: true,
  enabled: true,
  valueJson: true,
  projectId: true,
  environmentId: true,
  updatedAt: true,
} as const;

@Injectable()
export class FeatureFlagsApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProjectId(orgId: string, projectSlug: string): Promise<string> {
    const p = await this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: projectSlug },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('项目不存在');
    return p.id;
  }

  /** 同作用域内是否已有该 key（不含当前行） */
  private duplicateWhere(
    orgId: string,
    projectId: string | null,
    environmentId: string | null,
    key: string,
    excludeFlagId?: string,
  ): Prisma.FeatureFlagWhereInput {
    const base: Prisma.FeatureFlagWhereInput = { key };
    if (excludeFlagId) base.id = { not: excludeFlagId };

    if (environmentId) {
      return { ...base, environmentId };
    }
    if (projectId) {
      return { ...base, projectId, environmentId: null };
    }
    return { ...base, organizationId: orgId, projectId: null, environmentId: null };
  }

  async listFlags(orgId: string, projectSlug: string | null, environmentName?: string | null) {
    const envName = environmentName?.trim() ?? '';
    if (envName && !projectSlug) {
      throw new BadRequestException('environmentName 须与 projectSlug 同时提供');
    }

    const where: Prisma.FeatureFlagWhereInput = { organizationId: orgId };
    if (projectSlug) {
      const projectId = await this.getProjectId(orgId, projectSlug);
      where.projectId = projectId;
      if (envName) {
        const env = await this.prisma.environment.findFirst({
          where: { projectId, name: envName },
          select: { id: true },
        });
        if (!env) throw new NotFoundException('环境不存在');
        where.environmentId = env.id;
      } else {
        where.environmentId = null;
      }
    } else {
      where.projectId = null;
      where.environmentId = null;
    }

    return this.prisma.featureFlag.findMany({
      where,
      orderBy: { key: 'asc' },
      select: flagRowSelect,
    });
  }

  async createFlag(
    orgId: string,
    projectSlug: string | null,
    body: { key: string; enabled?: boolean; valueJson?: unknown; environmentName?: string | null },
  ) {
    const key = body.key?.trim() ?? '';
    if (!KEY_RE.test(key)) {
      throw new BadRequestException('key 须以字母开头，仅含字母数字 ._-，长度 1–128');
    }

    const envName = body.environmentName?.trim() ?? '';
    if (envName && !projectSlug) {
      throw new BadRequestException('environmentName 须与 projectSlug 同时提供');
    }

    let projectId: string | null = null;
    let environmentId: string | null = null;
    if (projectSlug) {
      projectId = await this.getProjectId(orgId, projectSlug);
      if (envName) {
        const env = await this.prisma.environment.findFirst({
          where: { projectId, name: envName },
          select: { id: true },
        });
        if (!env) throw new NotFoundException('环境不存在');
        environmentId = env.id;
      }
    }

    const dup = await this.prisma.featureFlag.findFirst({
      where: this.duplicateWhere(orgId, projectId, environmentId, key),
    });
    if (dup) throw new ConflictException('该范围内已存在同名 key');

    return this.prisma.featureFlag.create({
      data: {
        organizationId: orgId,
        projectId,
        environmentId,
        key,
        enabled: body.enabled ?? false,
        valueJson:
          body.valueJson === undefined
            ? undefined
            : (body.valueJson as Prisma.InputJsonValue),
      },
      select: flagRowSelect,
    });
  }

  async updateFlag(
    orgId: string,
    flagId: string,
    body: Partial<{ key: string; enabled: boolean; valueJson: unknown | null }>,
  ) {
    const row = await this.prisma.featureFlag.findFirst({
      where: { id: flagId, organizationId: orgId },
      select: { id: true, projectId: true, environmentId: true },
    });
    if (!row) throw new NotFoundException('特性开关不存在');

    const data: Prisma.FeatureFlagUpdateInput = {};
    if (body.key !== undefined) {
      const key = body.key.trim();
      if (!KEY_RE.test(key)) {
        throw new BadRequestException('key 须以字母开头，仅含字母数字 ._-，长度 1–128');
      }
      const dup = await this.prisma.featureFlag.findFirst({
        where: this.duplicateWhere(orgId, row.projectId, row.environmentId, key, flagId),
      });
      if (dup) throw new ConflictException('该范围内已存在同名 key');
      data.key = key;
    }
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.valueJson !== undefined) {
      data.valueJson = body.valueJson === null ? Prisma.JsonNull : (body.valueJson as Prisma.InputJsonValue);
    }

    return this.prisma.featureFlag.update({
      where: { id: flagId },
      data,
      select: flagRowSelect,
    });
  }

  async deleteFlag(orgId: string, flagId: string) {
    const row = await this.prisma.featureFlag.findFirst({ where: { id: flagId, organizationId: orgId } });
    if (!row) throw new NotFoundException('特性开关不存在');
    await this.prisma.featureFlag.delete({ where: { id: flagId } });
  }
}
