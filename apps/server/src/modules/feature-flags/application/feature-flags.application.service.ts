import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9._-]{0,127}$/;

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

  async listFlags(orgId: string, projectSlug: string | null) {
    const where: Prisma.FeatureFlagWhereInput = { organizationId: orgId };
    if (projectSlug) {
      const projectId = await this.getProjectId(orgId, projectSlug);
      where.projectId = projectId;
    } else {
      where.projectId = null;
    }
    return this.prisma.featureFlag.findMany({
      where,
      orderBy: { key: 'asc' },
      select: {
        id: true,
        key: true,
        enabled: true,
        valueJson: true,
        projectId: true,
        updatedAt: true,
      },
    });
  }

  async createFlag(
    orgId: string,
    projectSlug: string | null,
    body: { key: string; enabled?: boolean; valueJson?: unknown },
  ) {
    const key = body.key?.trim() ?? '';
    if (!KEY_RE.test(key)) {
      throw new BadRequestException('key 须以字母开头，仅含字母数字 ._-，长度 1–128');
    }
    const projectId = projectSlug ? await this.getProjectId(orgId, projectSlug) : null;

    const dup = await this.prisma.featureFlag.findFirst({
      where: { organizationId: orgId, projectId, key },
    });
    if (dup) throw new ConflictException('该范围内已存在同名 key');

    return this.prisma.featureFlag.create({
      data: {
        organizationId: orgId,
        projectId,
        key,
        enabled: body.enabled ?? false,
        valueJson:
          body.valueJson === undefined
            ? undefined
            : (body.valueJson as Prisma.InputJsonValue),
      },
      select: {
        id: true,
        key: true,
        enabled: true,
        valueJson: true,
        projectId: true,
        updatedAt: true,
      },
    });
  }

  async updateFlag(
    orgId: string,
    flagId: string,
    body: Partial<{ key: string; enabled: boolean; valueJson: unknown | null }>,
  ) {
    const row = await this.prisma.featureFlag.findFirst({ where: { id: flagId, organizationId: orgId } });
    if (!row) throw new NotFoundException('特性开关不存在');

    const data: Prisma.FeatureFlagUpdateInput = {};
    if (body.key !== undefined) {
      const key = body.key.trim();
      if (!KEY_RE.test(key)) {
        throw new BadRequestException('key 须以字母开头，仅含字母数字 ._-，长度 1–128');
      }
      const dup = await this.prisma.featureFlag.findFirst({
        where: {
          organizationId: orgId,
          projectId: row.projectId,
          key,
          id: { not: flagId },
        },
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
      select: {
        id: true,
        key: true,
        enabled: true,
        valueJson: true,
        projectId: true,
        updatedAt: true,
      },
    });
  }

  async deleteFlag(orgId: string, flagId: string) {
    const row = await this.prisma.featureFlag.findFirst({ where: { id: flagId, organizationId: orgId } });
    if (!row) throw new NotFoundException('特性开关不存在');
    await this.prisma.featureFlag.delete({ where: { id: flagId } });
  }
}
