import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import type { User } from '@prisma/client';
import { GitOAuthService } from './git-oauth.service';

@ApiTags('Git OAuth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/git/oauth')
export class GitOAuthStartController {
  constructor(private readonly oauth: GitOAuthService) {}

  @Get(':provider/start')
  @Roles(OrgRole.DEVELOPER)
  async start(
    @OrgId() orgId: string,
    @CurrentUser() user: User,
    @Param('provider') provider: string,
  ): Promise<{ url: string }> {
    const url = await this.oauth.buildAuthorizeUrl(orgId, user.id, provider);
    return { url };
  }
}
