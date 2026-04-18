import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { FeatureFlagsApplicationService } from './feature-flags.application.service';

describe('FeatureFlagsApplicationService', () => {
  it('listFlags 组织级：projectId 与 environmentId 均为 null', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      featureFlag: { findMany },
      project: { findFirst: vi.fn() },
      environment: { findFirst: vi.fn() },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await service.listFlags('org-1', null);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          projectId: null,
          environmentId: null,
        },
      }),
    );
  });

  it('listFlags 项目级：environmentId 为 null', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      featureFlag: { findMany },
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
      environment: { findFirst: vi.fn() },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await service.listFlags('org-1', 'my-app');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          projectId: 'proj-1',
          environmentId: null,
        },
      }),
    );
  });

  it('listFlags 环境级：带 environmentName', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      featureFlag: { findMany },
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
      environment: { findFirst: vi.fn().mockResolvedValue({ id: 'env-stg' }) },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await service.listFlags('org-1', 'my-app', 'staging');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          projectId: 'proj-1',
          environmentId: 'env-stg',
        },
      }),
    );
  });

  it('listFlags 仅有 environmentName 无 projectSlug 时抛 BadRequest', async () => {
    const prisma = {
      featureFlag: { findMany: vi.fn() },
      project: { findFirst: vi.fn() },
      environment: { findFirst: vi.fn() },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await expect(service.listFlags('org-1', null, 'staging')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listFlags 环境不存在时抛 NotFound', async () => {
    const prisma = {
      featureFlag: { findMany: vi.fn() },
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
      environment: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await expect(service.listFlags('org-1', 'my-app', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createFlag 同环境重复 key 抛 Conflict', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: 'dup' }) // duplicate check
      .mockResolvedValue(null);
    const prisma = {
      featureFlag: { findFirst, create: vi.fn() },
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
      environment: { findFirst: vi.fn().mockResolvedValue({ id: 'env-1' }) },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await expect(
      service.createFlag('org-1', 'my-app', {
        key: 'feature.x',
        environmentName: 'staging',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('createFlag 环境级写入 projectId 与 environmentId', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({
      id: 'f1',
      key: 'feature.x',
      enabled: false,
      valueJson: null,
      projectId: 'proj-1',
      environmentId: 'env-1',
      updatedAt: new Date(),
    });
    const prisma = {
      featureFlag: { findFirst, create },
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
      environment: { findFirst: vi.fn().mockResolvedValue({ id: 'env-1' }) },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await service.createFlag('org-1', 'my-app', {
      key: 'feature.x',
      environmentName: 'staging',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          projectId: 'proj-1',
          environmentId: 'env-1',
          key: 'feature.x',
        }),
      }),
    );
  });

  it('updateFlag 改 key 时在同作用域内查重（环境级用 environmentId）', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'f1',
        projectId: 'proj-1',
        environmentId: 'env-1',
      })
      .mockResolvedValueOnce(null);
    const update = vi.fn().mockResolvedValue({
      id: 'f1',
      key: 'feature.new',
      enabled: true,
      valueJson: null,
      projectId: 'proj-1',
      environmentId: 'env-1',
      updatedAt: new Date(),
    });
    const prisma = {
      featureFlag: { findFirst, update },
    } as unknown as PrismaService;
    const service = new FeatureFlagsApplicationService(prisma);

    await service.updateFlag('org-1', 'f1', { key: 'feature.new' });

    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        key: 'feature.new',
        id: { not: 'f1' },
        environmentId: 'env-1',
      },
    });
  });
});
