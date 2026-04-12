import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ingestBatchSchema, type IngestBatchInput } from './schemas';

function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

function payloadMessage(payload: Record<string, unknown>): string | null {
  const m = payload['message'];
  return typeof m === 'string' ? m.slice(0, 512) : null;
}

@Injectable()
export class IngestService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestBatch(authHeader: string | undefined, body: unknown): Promise<{
    accepted: number;
    rejected: number;
    errors: Array<{ index: number; reason: string }>;
  }> {
    const token = extractBearer(authHeader);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const parsed = ingestBatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid body', issues: parsed.error.flatten() });
    }
    const data = parsed.data as IngestBatchInput;

    const project = await this.prisma.monitoringProject.findFirst({
      where: { projectKey: data.projectKey, ingestToken: token },
    });
    if (!project) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const errors: Array<{ index: number; reason: string }> = [];
    const rows: Array<{
      projectId: string;
      eventId: string;
      clientTs: string | null;
      type: string;
      platform: string;
      release: string | null;
      route: string | null;
      message: string | null;
      payload: string;
      raw: string;
    }> = [];

    data.events.forEach((ev, index) => {
      try {
        const raw = JSON.stringify(ev);
        if (raw.length > 65536) {
          errors.push({ index, reason: 'event too large' });
          return;
        }
        rows.push({
          projectId: project.id,
          eventId: ev.eventId,
          clientTs: ev.timestamp,
          type: ev.type,
          platform: ev.platform,
          release: ev.release ?? null,
          route: ev.route ?? null,
          message: payloadMessage(ev.payload),
          payload: JSON.stringify(ev.payload),
          raw,
        });
      } catch {
        errors.push({ index, reason: 'serialize failed' });
      }
    });

    if (rows.length === 0) {
      return { accepted: 0, rejected: data.events.length, errors };
    }

    let accepted = 0;
    for (const row of rows) {
      try {
        await this.prisma.monitoringEvent.create({ data: row });
        accepted += 1;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }

    const rejected = data.events.length - accepted;
    return { accepted, rejected, errors };
  }
}
