import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RetentionService {
  private readonly log = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredEvents(): Promise<void> {
    const days = Math.max(1, parseInt(process.env['MONITORING_EVENT_RETENTION_DAYS'] ?? '30', 10) || 30);
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const deleted = await this.prisma.monitoringEvent.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    this.log.log(`Retention: deleted ${deleted.count} events older than ${days}d (before ${cutoff.toISOString()})`);

    await this.prisma.monitoringHourlyBucket.deleteMany({
      where: { bucketStart: { lt: cutoff } },
    });
  }
}
