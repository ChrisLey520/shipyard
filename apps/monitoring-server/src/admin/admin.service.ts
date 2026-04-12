import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '../generated/monitoring-prisma';
import { z } from 'zod';
import { assertPublicWebhookUrl, webhookAllowInsecureLocal } from '../common/webhook-url';
import { PrismaService } from '../prisma/prisma.service';
import { SymbolicateService } from '../symbolicate/symbolicate.service';

const alertCreateSchema = z.object({
  projectKey: z.string().min(1),
  name: z.string().min(1),
  eventType: z.string().min(1),
  windowMinutes: z.number().int().min(1).max(1440),
  threshold: z.number().int().min(1),
  silenceMinutes: z.number().int().min(1).max(10080),
  targets: z
    .array(
      z.object({
        channel: z.enum(['wecom', 'feishu', 'webhook']),
        webhookUrl: z.string().url(),
      }),
    )
    .min(1),
});

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly symbolicate: SymbolicateService,
  ) {}

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
      include: { project: { select: { projectKey: true, id: true } } },
    });
    if (!row) throw new NotFoundException();
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(row.raw) as Record<string, unknown>;
    } catch {
      event = { parseError: true };
    }

    const payload = event['payload'];
    const p = payload && typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
    const stack =
      typeof p['stack'] === 'string'
        ? p['stack']
        : typeof event['stack'] === 'string'
          ? (event['stack'] as string)
          : null;

    let symbolicated: { lines: string[]; notice: string | null } | null = null;
    if (row.type === 'error' && stack) {
      symbolicated = await this.symbolicate.symbolicatedStackLines(row.project.id, row.release, stack);
    }

    const breadcrumbs = Array.isArray(event['breadcrumbs']) ? event['breadcrumbs'] : undefined;

    return {
      id: row.id,
      eventId: row.eventId,
      receivedAt: row.receivedAt.toISOString(),
      projectKey: row.project.projectKey,
      event,
      symbolicatedStack: symbolicated,
      breadcrumbs,
    };
  }

  async listProjects(token: string | undefined) {
    this.assertAdmin(token);
    const rows = await this.prisma.monitoringProject.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectKey: true, createdAt: true },
    });
    return { items: rows };
  }

  async createProject(token: string | undefined, projectKey: string) {
    this.assertAdmin(token);
    const key = projectKey.trim();
    if (!key) throw new BadRequestException('projectKey required');
    const ingestToken = randomBytes(32).toString('hex');
    try {
      const p = await this.prisma.monitoringProject.create({
        data: { projectKey: key, ingestToken },
        select: { id: true, projectKey: true, ingestToken: true, createdAt: true },
      });
      return p;
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        throw new ConflictException('projectKey already exists');
      }
      throw e;
    }
  }

  async rotateIngestToken(token: string | undefined, projectId: string) {
    this.assertAdmin(token);
    const ingestToken = randomBytes(32).toString('hex');
    try {
      const p = await this.prisma.monitoringProject.update({
        where: { id: projectId },
        data: { ingestToken },
        select: { id: true, projectKey: true, ingestToken: true },
      });
      return p;
    } catch {
      throw new NotFoundException();
    }
  }

  async hourlyMetrics(
    token: string | undefined,
    q: { projectKey: string; days: number; type?: string; release?: string },
  ) {
    this.assertAdmin(token);
    const project = await this.prisma.monitoringProject.findUnique({
      where: { projectKey: q.projectKey },
    });
    if (!project) throw new NotFoundException('project not found');
    const days = Math.min(90, Math.max(1, q.days));
    const since = new Date(Date.now() - days * 86_400_000);
    const where: Prisma.MonitoringHourlyBucketWhereInput = {
      projectId: project.id,
      bucketStart: { gte: since },
    };
    if (q.type) where.type = q.type;
    if (q.release !== undefined && q.release !== '') where.release = q.release;

    const rows = await this.prisma.monitoringHourlyBucket.findMany({
      where,
      orderBy: { bucketStart: 'asc' },
    });
    return {
      buckets: rows.map((r) => ({
        bucketStart: r.bucketStart.toISOString(),
        type: r.type,
        release: r.release,
        count: r.count,
      })),
    };
  }

  async createAlertRule(token: string | undefined, body: unknown) {
    this.assertAdmin(token);
    const parsed = alertCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ issues: parsed.error.flatten() });
    }
    const d = parsed.data;
    const allowLocal = webhookAllowInsecureLocal();
    for (const t of d.targets) {
      assertPublicWebhookUrl(t.webhookUrl, allowLocal);
    }
    const project = await this.prisma.monitoringProject.findUnique({
      where: { projectKey: d.projectKey },
    });
    if (!project) throw new NotFoundException('project not found');

    const rule = await this.prisma.alertRule.create({
      data: {
        projectId: project.id,
        name: d.name,
        eventType: d.eventType,
        windowMinutes: d.windowMinutes,
        threshold: d.threshold,
        silenceMinutes: d.silenceMinutes,
        targets: {
          create: d.targets.map((t) => ({
            channel: t.channel,
            webhookUrl: t.webhookUrl,
          })),
        },
      },
      include: { targets: true },
    });
    return rule;
  }

  async listAlertRules(token: string | undefined, projectKey?: string) {
    this.assertAdmin(token);
    const where: Prisma.AlertRuleWhereInput = {};
    if (projectKey) {
      where.project = { projectKey };
    }
    return this.prisma.alertRule.findMany({
      where,
      include: { targets: true, project: { select: { projectKey: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
