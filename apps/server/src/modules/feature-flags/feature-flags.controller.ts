import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';
import { FeatureFlagsApplicationService } from './application/feature-flags.application.service';

@ApiTags('特性开关')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsApplicationService) {}

  /** projectSlug 为空：组织级；有 projectSlug 无 environmentName：项目级；二者皆有：环境级 */
  @Get()
  @Roles(OrgRole.VIEWER)
  async list(
    @OrgId() orgId: string,
    @Query('projectSlug') projectSlug?: string,
    @Query('environmentName') environmentName?: string,
  ) {
    const slug = projectSlug?.trim() || null;
    return this.flags.listFlags(orgId, slug, environmentName);
  }

  @Post()
  @Roles(OrgRole.DEVELOPER)
  async create(
    @OrgId() orgId: string,
    @Body()
    body: {
      key: string;
      enabled?: boolean;
      valueJson?: unknown;
      projectSlug?: string | null;
      environmentName?: string | null;
    },
  ) {
    const slug = body.projectSlug?.trim() || null;
    return this.flags.createFlag(orgId, slug, {
      key: body.key,
      enabled: body.enabled,
      valueJson: body.valueJson,
      environmentName: body.environmentName,
    });
  }

  @Patch(':flagId')
  @Roles(OrgRole.DEVELOPER)
  async update(
    @OrgId() orgId: string,
    @Param('flagId') flagId: string,
    @Body() body: Partial<{ key: string; enabled: boolean; valueJson: unknown | null }>,
  ) {
    return this.flags.updateFlag(orgId, flagId, body);
  }

  @Delete(':flagId')
  @Roles(OrgRole.DEVELOPER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@OrgId() orgId: string, @Param('flagId') flagId: string) {
    await this.flags.deleteFlag(orgId, flagId);
  }
}
