import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { Queue } from 'bullmq';

@Injectable()
export class ApprovalsApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listApprovals(orgId: string) {
    // 仅返回该组织下项目相关的审批单
    return this.prisma.approvalRequest.findMany({
      where: {
        deployment: { project: { organizationId: orgId } },
      },
      include: {
        deployment: {
          include: { environment: { select: { id: true, name: true } } },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reviewApproval(opts: {
    orgId: string;
    approvalId: string;
    reviewerUserId: string;
    reviewerRole: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }) {
    if (!['owner', 'admin'].includes(opts.reviewerRole)) {
      throw new ForbiddenException('只有 Owner/Admin 可以审批');
    }

    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: opts.approvalId },
      include: {
        deployment: {
          include: {
            project: { select: { id: true, organizationId: true } },
          },
        },
      },
    });
    if (!approval) throw new NotFoundException('审批单不存在');
    if (approval.deployment.project.organizationId !== opts.orgId) {
      throw new ForbiddenException('无权审批该组织的部署');
    }
    if (approval.status !== 'pending') {
      throw new ForbiddenException('该审批单已处理');
    }
    if (approval.expiresAt < new Date()) {
      await this.prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { status: 'expired' },
      });
      await this.prisma.deployment.update({
        where: { id: approval.deploymentId },
        data: { status: 'cancelled' },
      });
      throw new ForbiddenException('审批单已过期');
    }

    // 禁止自审（仅当有发起人时检查）
    if (approval.requestedByUserId && approval.requestedByUserId === opts.reviewerUserId) {
      throw new ForbiddenException('不能审批自己发起的部署');
    }

    if (opts.decision === 'rejected') {
      await this.prisma.$transaction([
        this.prisma.approvalRequest.update({
          where: { id: approval.id },
          data: {
            status: 'rejected',
            reviewedByUserId: opts.reviewerUserId,
            comment: opts.comment ?? null,
          },
        }),
        this.prisma.deployment.update({
          where: { id: approval.deploymentId },
          data: { status: 'cancelled' },
        }),
      ]);
      return { status: 'rejected' as const };
    }

    // approved：放行入 DeployQueue
    const deployment = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: approval.deploymentId },
      select: { id: true, projectId: true, environmentId: true },
    });
    if (!deployment.environmentId) throw new ForbiddenException('PR Preview 不走审批流');

    await this.prisma.$transaction([
      this.prisma.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: 'approved',
          reviewedByUserId: opts.reviewerUserId,
          comment: opts.comment ?? null,
        },
      }),
      this.prisma.deployment.update({
        where: { id: approval.deploymentId },
        data: { status: 'queued' },
      }),
    ]);

    const queue = new Queue(`deploy-${opts.orgId}`, { connection: this.redis.getClient() });
    await queue.add(
      'deploy',
      {
        deploymentId: deployment.id,
        projectId: deployment.projectId,
        environmentId: deployment.environmentId,
        orgId: opts.orgId,
      },
      { jobId: `deploy-${deployment.id}` },
    );

    return { status: 'approved' as const };
  }
}

