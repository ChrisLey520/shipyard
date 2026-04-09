import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId, OrgRole as OrgRoleDec, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import { ApprovalsService } from './approvals.service';
import type { User } from '@prisma/client';

@ApiTags('审批')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @Roles(OrgRole.VIEWER)
  list(@OrgId() orgId: string) {
    return this.approvals.listApprovals(orgId);
  }

  @Post(':approvalId/review')
  @HttpCode(HttpStatus.OK)
  @Roles(OrgRole.ADMIN)
  review(
    @OrgId() orgId: string,
    @Param('approvalId') approvalId: string,
    @CurrentUser() user: User,
    @OrgRoleDec() reviewerRole: string,
    @Body() body: { decision: 'approved' | 'rejected'; comment?: string },
  ) {
    return this.approvals.reviewApproval({
      orgId,
      approvalId,
      reviewerUserId: user.id,
      reviewerRole,
      decision: body.decision,
      comment: body.comment,
    });
  }
}

