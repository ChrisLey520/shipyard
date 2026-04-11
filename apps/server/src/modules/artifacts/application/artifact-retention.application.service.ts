import { Injectable, Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * 按组织 artifactRetention 保留最近 N 个构建产物（BuildArtifact + 本地 tar.gz），超出则删最旧
 */
@Injectable()
export class ArtifactRetentionApplicationService {
  private readonly logger = new Logger(ArtifactRetentionApplicationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 对指定组织执行 count-based 清理（幂等，可频繁调用）
   */
  async enforceForOrganization(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { artifactRetention: true },
    });
    if (!org) return;

    const keep = Math.max(1, Math.min(100, org.artifactRetention));
    const artifacts = await this.prisma.buildArtifact.findMany({
      where: {
        deployment: {
          project: { organizationId },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, storagePath: true },
    });

    if (artifacts.length <= keep) return;

    const toRemove = artifacts.slice(keep);
    for (const a of toRemove) {
      try {
        await this.prisma.$transaction([
          this.prisma.deployment.updateMany({
            where: { artifactId: a.id },
            data: { artifactId: null },
          }),
          this.prisma.buildArtifact.delete({ where: { id: a.id } }),
        ]);
        if (a.storagePath && existsSync(a.storagePath)) {
          await unlink(a.storagePath).catch((e) => {
            this.logger.warn(`删除产物文件失败 ${a.storagePath}: ${e}`);
          });
        }
      } catch (e) {
        this.logger.warn(`清理产物记录失败 artifactId=${a.id}: ${e}`);
      }
    }

    if (toRemove.length > 0) {
      this.logger.log(
        `组织 ${organizationId} 产物清理：删除 ${toRemove.length} 条，保留最近 ${keep} 个`,
      );
    }
  }
}
