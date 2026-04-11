import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { NotificationChannel } from '@shipyard/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import {
  assertValidNotificationConfig,
  decryptNotificationSecrets,
  mergeNotificationConfigForUpdate,
  sanitizeNotificationConfigForApi,
  toPersistedNotificationConfig,
} from '../notification-config.crypto';
import type { CreateNotificationDto } from '../dto/create-notification.dto';
import type { UpdateNotificationDto } from '../dto/update-notification.dto';

@Injectable()
export class NotificationsCrudApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private async projectIdOrThrow(orgId: string, projectSlug: string): Promise<string> {
    const p = await this.prisma.project.findFirst({
      where: { organizationId: orgId, slug: projectSlug },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('项目不存在');
    return p.id;
  }

  private toRowDto(row: {
    id: string;
    projectId: string;
    channel: string;
    config: unknown;
    events: string[];
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const decrypted = decryptNotificationSecrets(this.crypto, row.channel, row.config as Record<string, unknown>);
    const config = sanitizeNotificationConfigForApi(row.channel, decrypted);
    return {
      id: row.id,
      projectId: row.projectId,
      channel: row.channel,
      events: row.events,
      enabled: row.enabled,
      config,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(orgId: string, projectSlug: string) {
    const projectId = await this.projectIdOrThrow(orgId, projectSlug);
    const rows = await this.prisma.notification.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toRowDto(r));
  }

  async create(orgId: string, projectSlug: string, dto: CreateNotificationDto) {
    const projectId = await this.projectIdOrThrow(orgId, projectSlug);
    const plain = { ...dto.config };
    if (plain['smtpPort'] !== undefined && typeof plain['smtpPort'] === 'string') {
      plain['smtpPort'] = Number(plain['smtpPort']);
    }
    assertValidNotificationConfig(dto.channel, plain);
    const persisted = toPersistedNotificationConfig(this.crypto, dto.channel, plain);
    const row = await this.prisma.notification.create({
      data: {
        projectId,
        channel: dto.channel,
        events: dto.events,
        config: persisted as Prisma.InputJsonValue,
        enabled: dto.enabled ?? true,
      },
    });
    return this.toRowDto(row);
  }

  async update(orgId: string, projectSlug: string, notificationId: string, dto: UpdateNotificationDto) {
    const projectId = await this.projectIdOrThrow(orgId, projectSlug);
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, projectId },
    });
    if (!row) throw new NotFoundException('通知配置不存在');
    if (dto.channel !== undefined && dto.channel !== row.channel) {
      throw new BadRequestException('不支持修改 channel');
    }
    const channel = row.channel as NotificationChannel;
    const patchConfig = dto.config !== undefined;
    const mergedPlain = patchConfig
      ? mergeNotificationConfigForUpdate(this.crypto, channel, row.config as Record<string, unknown>, dto.config)
      : decryptNotificationSecrets(this.crypto, channel, row.config as Record<string, unknown>);
    if (mergedPlain['smtpPort'] !== undefined && typeof mergedPlain['smtpPort'] === 'string') {
      mergedPlain['smtpPort'] = Number(mergedPlain['smtpPort']);
    }
    if (patchConfig) {
      assertValidNotificationConfig(channel, mergedPlain);
    }
    const persisted = patchConfig ? toPersistedNotificationConfig(this.crypto, channel, mergedPlain) : undefined;
    const data: Prisma.NotificationUpdateInput = {
      ...(dto.events !== undefined ? { events: dto.events } : {}),
      ...(patchConfig && persisted !== undefined ? { config: persisted as Prisma.InputJsonValue } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    };
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data,
    });
    return this.toRowDto(updated);
  }

  async remove(orgId: string, projectSlug: string, notificationId: string): Promise<void> {
    const projectId = await this.projectIdOrThrow(orgId, projectSlug);
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, projectId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('通知配置不存在');
    await this.prisma.notification.delete({ where: { id: notificationId } });
  }
}
