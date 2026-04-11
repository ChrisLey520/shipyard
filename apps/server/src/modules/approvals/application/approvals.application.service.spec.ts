import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { RedisService } from '../../../common/redis/redis.service';
import { ApprovalsApplicationService } from './approvals.application.service';

describe('ApprovalsApplicationService', () => {
  it('listApprovals 使用 Prisma 按组织过滤并返回列表', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'ar1' }]);
    const prisma = { approvalRequest: { findMany } } as unknown as PrismaService;
    const redis = { getClient: vi.fn() } as unknown as RedisService;
    const service = new ApprovalsApplicationService(prisma, redis);

    const rows = await service.listApprovals('org-xyz');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deployment: { project: { organizationId: 'org-xyz' } } },
        take: 200,
      }),
    );
    expect(rows).toEqual([{ id: 'ar1' }]);
  });
});
