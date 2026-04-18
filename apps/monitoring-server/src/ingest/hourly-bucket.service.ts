import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function utcHourStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0));
}

@Injectable()
export class HourlyBucketService {
  constructor(private readonly prisma: PrismaService) {}

  /** 写入事件成功后调用，更新按小时预聚合桶 */
  async bump(projectId: string, type: string, release: string | null, at: Date): Promise<void> {
    const bucketStart = utcHourStart(at);
    const rel = release ?? '';
    await this.prisma.monitoringHourlyBucket.upsert({
      where: {
        projectId_bucketStart_type_release: {
          projectId,
          bucketStart,
          type,
          release: rel,
        },
      },
      create: {
        projectId,
        bucketStart,
        type,
        release: rel,
        count: 1,
      },
      update: { count: { increment: 1 } },
    });
  }
}
