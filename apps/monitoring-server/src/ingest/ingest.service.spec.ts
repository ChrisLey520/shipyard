import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/monitoring-prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { HourlyBucketService } from './hourly-bucket.service';
import { IngestService } from './ingest.service';

describe('IngestService', () => {
  const findFirst = vi.fn();
  const create = vi.fn();
  const bump = vi.fn();

  const prismaMock = {
    monitoringProject: { findFirst },
    monitoringEvent: { create },
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createService(): IngestService {
    return new IngestService(
      prismaMock as unknown as PrismaService,
      { bump } as unknown as HourlyBucketService,
    );
  }

  function validBody() {
    return {
      projectKey: 'p1',
      events: [
        {
          eventId: 'evt12345678',
          type: 'error' as const,
          timestamp: '2026-01-01T00:00:00.000Z',
          platform: 'web',
          sdkVersion: '1.0.0',
          sessionId: 'sess1234',
          payload: { message: 'hi' },
        },
      ],
    };
  }

  it('缺少 Bearer 抛 UnauthorizedException', async () => {
    const svc = createService();
    await expect(svc.ingestBatch(undefined, validBody())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('非法 body 抛 BadRequestException', async () => {
    const svc = createService();
    await expect(svc.ingestBatch('Bearer t', { projectKey: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('projectKey 与 token 不匹配抛 UnauthorizedException', async () => {
    findFirst.mockResolvedValueOnce(null);
    const svc = createService();
    await expect(svc.ingestBatch('Bearer wrong', validBody())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findFirst).toHaveBeenCalled();
  });

  it('成功写入并 bump', async () => {
    findFirst.mockResolvedValueOnce({ id: 'proj-1' });
    const receivedAt = new Date('2026-01-02T00:00:00.000Z');
    create.mockResolvedValueOnce({
      projectId: 'proj-1',
      type: 'error',
      release: null,
      receivedAt,
    });
    const svc = createService();
    const out = await svc.ingestBatch('Bearer tok', validBody());
    expect(out).toEqual({ accepted: 1, rejected: 0, errors: [] });
    expect(bump).toHaveBeenCalledWith('proj-1', 'error', null, receivedAt);
  });

  it('P2002 不增加 accepted，rejected 按实现为 events.length - accepted', async () => {
    findFirst.mockResolvedValueOnce({ id: 'proj-1' });
    const receivedAt = new Date('2026-01-02T00:00:00.000Z');
    create
      .mockResolvedValueOnce({
        projectId: 'proj-1',
        type: 'error',
        release: null,
        receivedAt,
      })
      .mockImplementationOnce(() => {
        throw new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['projectId', 'eventId'] },
        });
      });

    const body = {
      projectKey: 'p1',
      events: [
        {
          eventId: 'evt11111111',
          type: 'error' as const,
          timestamp: '2026-01-01T00:00:00.000Z',
          platform: 'web',
          sdkVersion: '1.0.0',
          sessionId: 'sess1234',
          payload: {},
        },
        {
          eventId: 'evt22222222',
          type: 'error' as const,
          timestamp: '2026-01-01T00:00:00.000Z',
          platform: 'web',
          sdkVersion: '1.0.0',
          sessionId: 'sess1234',
          payload: {},
        },
      ],
    };

    const svc = createService();
    const out = await svc.ingestBatch('Bearer tok', body);
    expect(out.accepted).toBe(1);
    expect(out.rejected).toBe(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('单条过大进入 errors 且不入库', async () => {
    findFirst.mockResolvedValueOnce({ id: 'proj-1' });
    const big = 'x'.repeat(70000);
    const svc = createService();
    const out = await svc.ingestBatch('Bearer tok', {
      projectKey: 'p1',
      events: [
        {
          eventId: 'evt12345678',
          type: 'error' as const,
          timestamp: '2026-01-01T00:00:00.000Z',
          platform: 'web',
          sdkVersion: '1.0.0',
          sessionId: 'sess1234',
          payload: { blob: big },
        },
      ],
    });
    expect(out.accepted).toBe(0);
    expect(out.rejected).toBe(1);
    expect(out.errors.some((e) => e.reason === 'event too large')).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
});
