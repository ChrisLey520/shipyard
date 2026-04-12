import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(token: string | undefined): void {
    const expected = process.env['MONITORING_ADMIN_TOKEN'];
    if (!expected || token !== expected) {
      throw new ForbiddenException();
    }
  }

  async list(params: {
    token: string | undefined;
    projectKey?: string;
    platform?: string;
    release?: string;
    route?: string;
    type?: string;
    page: number;
    pageSize: number;
  }) {
    this.assertAdmin(params.token);
    const where: Prisma.MonitoringEventWhereInput = {};
    if (params.projectKey) {
      where.project = { projectKey: params.projectKey };
    }
    if (params.platform) where.platform = params.platform;
    if (params.release) where.release = params.release;
    if (params.route) where.route = { contains: params.route };
    if (params.type) where.type = params.type;

    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.monitoringEvent.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: params.pageSize,
        include: { project: { select: { projectKey: true } } },
      }),
      this.prisma.monitoringEvent.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        eventId: e.eventId,
        receivedAt: e.receivedAt.toISOString(),
        type: e.type,
        platform: e.platform,
        release: e.release,
        route: e.route,
        message: e.message,
        projectKey: e.project.projectKey,
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async getById(token: string | undefined, id: string) {
    this.assertAdmin(token);
    const row = await this.prisma.monitoringEvent.findUnique({
      where: { id },
      include: { project: { select: { projectKey: true } } },
    });
    if (!row) throw new NotFoundException();
    let event: unknown;
    try {
      event = JSON.parse(row.raw) as unknown;
    } catch {
      event = { parseError: true };
    }
    return {
      id: row.id,
      eventId: row.eventId,
      receivedAt: row.receivedAt.toISOString(),
      projectKey: row.project.projectKey,
      event,
    };
  }
}
