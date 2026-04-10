import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { OrgRole } from '@shipyard/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ShipyardHttpException } from '../http/shipyard-http.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user: { id: string };
      params: Record<string, string>;
    }>();
    const user = request.user;
    const orgSlug = request.params['orgSlug'];

    if (!orgSlug) return true;

    const org = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new ShipyardHttpException(HttpStatus.FORBIDDEN, { code: 'ORG_NOT_FOUND' });

    const member = await this.prisma.orgMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    });

    if (!member) throw new ShipyardHttpException(HttpStatus.FORBIDDEN, { code: 'ORG_NOT_MEMBER' });

    // 角色层级：owner > admin > developer > viewer
    const hierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      developer: 2,
      viewer: 1,
    };

    const userLevel = hierarchy[member.role] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => hierarchy[r] ?? 99));

    if (userLevel < minRequired) {
      throw new ShipyardHttpException(HttpStatus.FORBIDDEN, { code: 'ORG_PERMISSION_DENIED' });
    }

    // 将 orgId 和 role 挂载到 request，供后续 handler 使用
    (request as Record<string, unknown>)['orgId'] = org.id;
    (request as Record<string, unknown>)['orgRole'] = member.role;

    return true;
  }
}
