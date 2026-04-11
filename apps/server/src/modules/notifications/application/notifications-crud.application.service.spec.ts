import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationEvent } from '@shipyard/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { CryptoService } from '../../../common/crypto/crypto.service';
import { NotificationsCrudApplicationService } from './notifications-crud.application.service';

describe('NotificationsCrudApplicationService', () => {
  const findFirstProject = vi.fn();
  const findManyNotif = vi.fn();
  const createNotif = vi.fn();
  const findFirstNotif = vi.fn();
  const updateNotif = vi.fn();
  const deleteNotif = vi.fn();

  const prisma = {
    project: { findFirst: findFirstProject },
    notification: {
      findMany: findManyNotif,
      create: createNotif,
      findFirst: findFirstNotif,
      update: updateNotif,
      delete: deleteNotif,
    },
  } as unknown as PrismaService;

  const encrypt = vi.fn((s: string) => `ENC(${s})`);
  const decrypt = vi.fn((s: string) => {
    const m = /^ENC\((.+)\)$/.exec(s);
    return m ? m[1]! : s;
  });
  const crypto = { encrypt, decrypt } as unknown as CryptoService;

  let service: NotificationsCrudApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsCrudApplicationService(prisma, crypto);
  });

  it('list：project 不存在则 404', async () => {
    findFirstProject.mockResolvedValue(null);
    await expect(service.list('org-1', 'slug-x')).rejects.toThrow(NotFoundException);
  });

  it('list：按 projectId 查询且 config 脱敏', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    const now = new Date();
    findManyNotif.mockResolvedValue([
      {
        id: 'n1',
        projectId: 'p1',
        channel: NotificationChannel.WEBHOOK,
        config: { url: 'https://ex.com/h', secret: 'ENC(mysecret)' },
        events: [NotificationEvent.BUILD_SUCCESS],
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const rows = await service.list('org-1', 'slug-x');

    expect(findFirstProject).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', slug: 'slug-x' },
      select: { id: true },
    });
    expect(findManyNotif).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].config).toEqual({ url: 'https://ex.com/h', secretConfigured: true });
    expect(rows[0].config).not.toHaveProperty('secret');
  });

  it('create：project 不存在则 404', async () => {
    findFirstProject.mockResolvedValue(null);
    await expect(
      service.create('org-1', 'slug-x', {
        channel: NotificationChannel.WEBHOOK,
        events: [NotificationEvent.BUILD_SUCCESS],
        config: { url: 'https://ex.com' },
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('create：敏感字段加密写入', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    const now = new Date();
    createNotif.mockResolvedValue({
      id: 'n1',
      projectId: 'p1',
      channel: NotificationChannel.WEBHOOK,
      config: { url: 'https://ex.com', secret: 'ENC(x)' },
      events: [NotificationEvent.BUILD_SUCCESS],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });

    await service.create('org-1', 'slug-x', {
      channel: NotificationChannel.WEBHOOK,
      events: [NotificationEvent.BUILD_SUCCESS],
      config: { url: 'https://ex.com', secret: 'x' },
    });

    expect(encrypt).toHaveBeenCalledWith('x');
    expect(createNotif).toHaveBeenCalled();
    const call = createNotif.mock.calls[0]![0] as {
      data: { config: Record<string, unknown> };
    };
    expect(call.data.config).toEqual({ url: 'https://ex.com', secret: 'ENC(x)' });
  });

  it('update：通知不存在则 404', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    findFirstNotif.mockResolvedValue(null);
    await expect(service.update('org-1', 'slug-x', 'nid', { enabled: false })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update：不允许修改 channel', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    findFirstNotif.mockResolvedValue({
      id: 'nid',
      projectId: 'p1',
      channel: NotificationChannel.WEBHOOK,
      config: { url: 'https://a.com' },
      events: [],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      service.update('org-1', 'slug-x', 'nid', { channel: NotificationChannel.EMAIL }),
    ).rejects.toThrow(BadRequestException);
  });

  it('update：仅 PATCH enabled 时 prisma.update 的 data 不含 config', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    const row = {
      id: 'nid',
      projectId: 'p1',
      channel: NotificationChannel.WEBHOOK,
      config: { url: 'https://a.com' },
      events: [NotificationEvent.BUILD_SUCCESS],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    findFirstNotif.mockResolvedValue(row);
    updateNotif.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...row, ...data }),
    );

    await service.update('org-1', 'slug-x', 'nid', { enabled: false });

    expect(updateNotif).toHaveBeenCalledWith({
      where: { id: 'nid' },
      data: { enabled: false },
    });
    expect(updateNotif.mock.calls[0]![0].data).not.toHaveProperty('config');
  });

  it('update：PATCH config 且 secret 为空串时保留原密文', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    const row = {
      id: 'nid',
      projectId: 'p1',
      channel: NotificationChannel.WEBHOOK,
      config: { url: 'https://old.com', secret: 'ENC(keepme)' },
      events: [NotificationEvent.BUILD_SUCCESS],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    findFirstNotif.mockResolvedValue(row);
    updateNotif.mockImplementation(({ data }: { data: { config?: Record<string, unknown> } }) =>
      Promise.resolve({
        ...row,
        ...data,
        config: data.config ?? row.config,
      }),
    );

    await service.update('org-1', 'slug-x', 'nid', {
      config: { url: 'https://new.com', secret: '' },
    });

    const data = updateNotif.mock.calls[0]![0].data as { config: Record<string, unknown> };
    expect(data.config.url).toBe('https://new.com');
    expect(data.config.secret).toBe('ENC(keepme)');
  });

  it('remove：不存在则 404', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    findFirstNotif.mockResolvedValue(null);
    await expect(service.remove('org-1', 'slug-x', 'nid')).rejects.toThrow(NotFoundException);
  });

  it('remove：存在则 delete', async () => {
    findFirstProject.mockResolvedValue({ id: 'p1' });
    findFirstNotif.mockResolvedValue({ id: 'nid' });
    await service.remove('org-1', 'slug-x', 'nid');
    expect(deleteNotif).toHaveBeenCalledWith({ where: { id: 'nid' } });
  });
});
