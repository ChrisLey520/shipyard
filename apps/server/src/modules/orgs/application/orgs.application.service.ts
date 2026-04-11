import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MailService } from '../../auth/mail.service';
import { v4 as uuidv4 } from 'uuid';
import { ShipyardHttpException } from '../../../common/http/shipyard-http.exception';

@Injectable()
export class OrgsApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async createOrg(userId: string, name: string, slug: string) {
    const existing = await this.prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('组织 slug 已被使用');

    const org = await this.prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: { userId, role: 'owner' },
        },
      },
    });
    return org;
  }

  async getOrgsForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      include: { members: { where: { userId }, select: { role: true } } },
    });
  }

  async getOrgBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({ where: { slug } });
    if (!org) throw new ShipyardHttpException(404, { code: 'ORG_NOT_FOUND' });
    return org;
  }

  async updateOrg(orgId: string, data: {
    name?: string;
    slug?: string;
    buildConcurrency?: number;
    artifactRetention?: number;
  }) {
    const patch: {
      name?: string;
      slug?: string;
      buildConcurrency?: number;
      artifactRetention?: number;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.buildConcurrency !== undefined) patch.buildConcurrency = data.buildConcurrency;
    if (data.artifactRetention !== undefined) patch.artifactRetention = data.artifactRetention;
    if (data.slug !== undefined) {
      const next = data.slug.trim();
      if (next.length < 1 || next.length > 64 || !/^[a-z0-9-]+$/.test(next)) {
        throw new BadRequestException('URL 标识仅允许小写字母、数字和连字符，长度 1–64');
      }
      const taken = await this.prisma.organization.findFirst({
        where: { slug: next, id: { not: orgId } },
      });
      if (taken) throw new ConflictException('组织 slug 已被使用');
      patch.slug = next;
    }
    if (Object.keys(patch).length === 0) {
      return this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    }
    return this.prisma.organization.update({ where: { id: orgId }, data: patch });
  }

  async getMembers(orgId: string) {
    return this.prisma.orgMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async inviteMember(orgId: string, inviterUserId: string, email: string, role: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const inviter = await this.prisma.user.findUniqueOrThrow({ where: { id: inviterUserId } });

    // 已是成员则拒绝
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const member = await this.prisma.orgMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (member) throw new ConflictException('该用户已是组织成员');
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.orgInvitation.create({
      data: { organizationId: orgId, email, role, token, expiresAt, invitedByUserId: inviterUserId },
    });

    await this.mail.sendOrgInvitation(email, org.name, inviter.name, token);
    return { message: '邀请已发送' };
  }

  async acceptInvitation(token: string, userId: string) {
    const inv = await this.prisma.orgInvitation.findUnique({ where: { token } });
    if (!inv || inv.status !== 'pending' || inv.expiresAt < new Date()) {
      throw new ForbiddenException('邀请链接无效或已过期');
    }

    await this.prisma.$transaction([
      this.prisma.orgMember.create({
        data: { organizationId: inv.organizationId, userId, role: inv.role },
      }),
      this.prisma.orgInvitation.update({ where: { id: inv.id }, data: { status: 'accepted' } }),
    ]);

    return this.prisma.organization.findUniqueOrThrow({ where: { id: inv.organizationId } });
  }

  async updateMemberRole(orgId: string, targetUserId: string, newRole: string, operatorRole: string) {
    const target = await this.prisma.orgMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
    if (target.role === 'owner') throw new ForbiddenException('无法修改 Owner 角色');
    if (operatorRole !== 'owner' && newRole === 'owner') throw new ForbiddenException('只有 Owner 可以转让所有权');

    return this.prisma.orgMember.update({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
      data: { role: newRole },
    });
  }

  async removeMember(orgId: string, targetUserId: string) {
    const target = await this.prisma.orgMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
    if (target.role === 'owner') throw new ForbiddenException('无法移除 Owner');

    await this.prisma.orgMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
  }
}
