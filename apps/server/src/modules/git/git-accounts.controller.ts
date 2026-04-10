import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import { GitAccountsService } from './git-accounts.service';

@ApiTags('Git Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/git-accounts')
export class GitAccountsController {
  constructor(private readonly accounts: GitAccountsService) {}

  @Get()
  @Roles(OrgRole.VIEWER)
  list(@OrgId() orgId: string) {
    return this.accounts.list(orgId);
  }

  @Post()
  @Roles(OrgRole.DEVELOPER)
  create(
    @OrgId() orgId: string,
    @Body() body: {
      name: string;
      gitProvider: string;
      baseUrl?: string;
      accessToken: string;
      gitUsername?: string;
    },
  ) {
    return this.accounts.create(orgId, body);
  }

  @Get(':gitAccountId/repos')
  @Roles(OrgRole.VIEWER)
  listRepos(
    @OrgId() orgId: string,
    @Param('gitAccountId') gitAccountId: string,
  ) {
    return this.accounts.listRepos(orgId, gitAccountId);
  }

  @Patch(':gitAccountId')
  @Roles(OrgRole.DEVELOPER)
  update(
    @OrgId() orgId: string,
    @Param('gitAccountId') gitAccountId: string,
    @Body() body: {
      name?: string;
      baseUrl?: string | null;
      accessToken?: string;
      gitUsername?: string | null;
      enabled?: boolean;
    },
  ) {
    return this.accounts.update(orgId, gitAccountId, body);
  }

  @Delete(':gitAccountId')
  @Roles(OrgRole.ADMIN)
  remove(@OrgId() orgId: string, @Param('gitAccountId') gitAccountId: string) {
    return this.accounts.remove(orgId, gitAccountId);
  }
}

