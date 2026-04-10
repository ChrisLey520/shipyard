import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrgsService } from './orgs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, OrgId, OrgRole as OrgRoleDec } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import type { User } from '@prisma/client';

@ApiTags('组织')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  getMyOrgs(@CurrentUser() user: User) {
    return this.orgs.getOrgsForUser(user.id);
  }

  @Post()
  createOrg(@CurrentUser() user: User, @Body() body: { name: string; slug: string }) {
    return this.orgs.createOrg(user.id, body.name, body.slug);
  }

  @Get(':orgSlug')
  @Roles(OrgRole.VIEWER)
  getOrg(@Param('orgSlug') slug: string) {
    return this.orgs.getOrgBySlug(slug);
  }

  @Patch(':orgSlug')
  @Roles(OrgRole.ADMIN)
  updateOrg(@OrgId() orgId: string, @Body() body: {
    name?: string;
    slug?: string;
    buildConcurrency?: number;
    artifactRetention?: number;
  }) {
    return this.orgs.updateOrg(orgId, body);
  }

  @Get(':orgSlug/members')
  @Roles(OrgRole.VIEWER)
  getMembers(@OrgId() orgId: string) {
    return this.orgs.getMembers(orgId);
  }

  @Post(':orgSlug/members/invite')
  @Roles(OrgRole.ADMIN)
  invite(
    @OrgId() orgId: string,
    @CurrentUser() user: User,
    @Body() body: { email: string; role: string },
  ) {
    return this.orgs.inviteMember(orgId, user.id, body.email, body.role);
  }

  @Post('invite/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvite(@CurrentUser() user: User, @Body() body: { token: string }) {
    return this.orgs.acceptInvitation(body.token, user.id);
  }

  @Patch(':orgSlug/members/:userId/role')
  @Roles(OrgRole.ADMIN)
  updateRole(
    @OrgId() orgId: string,
    @OrgRoleDec() operatorRole: string,
    @Param('userId') targetUserId: string,
    @Body() body: { role: string },
  ) {
    return this.orgs.updateMemberRole(orgId, targetUserId, body.role, operatorRole);
  }

  @Delete(':orgSlug/members/:userId')
  @Roles(OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(@OrgId() orgId: string, @Param('userId') targetUserId: string) {
    return this.orgs.removeMember(orgId, targetUserId);
  }
}
