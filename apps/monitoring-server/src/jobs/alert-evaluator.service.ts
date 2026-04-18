import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { assertPublicWebhookUrl, webhookAllowInsecureLocal } from '../common/webhook-url';

@Injectable()
export class AlertEvaluatorService {
  private readonly log = new Logger(AlertEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateRules(): Promise<void> {
    const rules = await this.prisma.alertRule.findMany({
      where: { enabled: true },
      include: { targets: true, project: { select: { projectKey: true } } },
    });
    const now = new Date();
    for (const rule of rules) {
      if (rule.silenceUntil && rule.silenceUntil > now) {
        continue;
      }
      const since = new Date(now.getTime() - rule.windowMinutes * 60_000);
      const count = await this.prisma.monitoringEvent.count({
        where: {
          projectId: rule.projectId,
          type: rule.eventType,
          receivedAt: { gte: since },
        },
      });
      if (count < rule.threshold) {
        continue;
      }
      const text = `[Shipyard Monitoring] 规则「${rule.name}」触发：项目 ${rule.project.projectKey} 在 ${rule.windowMinutes} 分钟内 ${rule.eventType} 共 ${count} 条（阈值 ${rule.threshold}）`;
      const allowLocal = webhookAllowInsecureLocal();
      for (const t of rule.targets) {
        try {
          assertPublicWebhookUrl(t.webhookUrl, allowLocal);
        } catch (e) {
          this.log.warn(`Skip target ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        try {
          const body =
            t.channel === 'feishu'
              ? JSON.stringify({ msg_type: 'text', content: { text } })
              : t.channel === 'wecom'
                ? JSON.stringify({ msgtype: 'text', text: { content: text } })
                : JSON.stringify({ text, rule: rule.name, projectKey: rule.project.projectKey, count });
          const r = await fetch(t.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
          if (!r.ok) {
            this.log.warn(`Webhook ${t.channel} HTTP ${r.status} for rule ${rule.id}`);
          }
        } catch (e) {
          this.log.warn(`Webhook send failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const silenceUntil = new Date(now.getTime() + rule.silenceMinutes * 60_000);
      await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastTriggeredAt: now, silenceUntil },
      });
    }
  }
}
