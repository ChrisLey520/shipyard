import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NotificationEvent } from '@shipyard/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import type { NotifyJobData } from './notify-worker.application.service';

/** 通知任务负载（Worker 原样 POST 给 webhook 或用于渲染 IM/邮件） */
export type NotificationEnqueuePayload = Record<string, unknown> & {
  message: string;
  detailUrl?: string;
  deploymentId?: string;
  projectSlug?: string;
  orgSlug?: string;
  approvalId?: string;
};

@Injectable()
export class NotificationEnqueueApplicationService {
  private readonly logger = new Logger(NotificationEnqueueApplicationService.name);
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private getQueue(orgId: string): Queue {
    if (!this.queues.has(orgId)) {
      this.queues.set(
        orgId,
        new Queue(`notify-${orgId}`, { connection: this.redis.getClient() }),
      );
    }
    return this.queues.get(orgId)!;
  }

  /**
   * 将通知任务写入 BullMQ（失败仅打日志，不抛出以免影响主流程）
   */
  async enqueue(
    projectId: string,
    event: NotificationEvent,
    message: string,
    opts?: {
      deploymentId?: string;
      approvalId?: string;
    },
  ): Promise<void> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          slug: true,
          organizationId: true,
          organization: { select: { slug: true } },
        },
      });
      if (!project) return;

      const appUrl = process.env['APP_URL']?.replace(/\/$/, '') ?? '';
      const orgSlug = project.organization.slug;
      const projectSlug = project.slug;
      let detailUrl = '';
      if (appUrl) {
        if (opts?.deploymentId) {
          detailUrl = `${appUrl}/orgs/${orgSlug}/projects/${projectSlug}/deployments/${opts.deploymentId}`;
        } else if (
          event === NotificationEvent.APPROVAL_PENDING ||
          event === NotificationEvent.APPROVAL_APPROVED ||
          event === NotificationEvent.APPROVAL_REJECTED
        ) {
          detailUrl = `${appUrl}/orgs/${orgSlug}/approvals`;
        } else {
          detailUrl = `${appUrl}/orgs/${orgSlug}/projects/${projectSlug}`;
        }
      }

      const payload: NotificationEnqueuePayload = {
        message,
        detailUrl: detailUrl || undefined,
        deploymentId: opts?.deploymentId,
        approvalId: opts?.approvalId,
        projectSlug,
        orgSlug,
        event,
      };

      const data: NotifyJobData = {
        projectId,
        event,
        payload,
      };

      await this.getQueue(project.organizationId).add('notify', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      });
    } catch (e) {
      this.logger.warn(`通知入队失败 projectId=${projectId} event=${event}: ${e}`);
    }
  }
}
