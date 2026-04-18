import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { OrgRole } from '@shipyard/shared';

@ApiTags('服务器')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get()
  @Roles(OrgRole.VIEWER)
  list(@OrgId() orgId: string) {
    return this.servers.listServers(orgId);
  }

  @Post()
  @Roles(OrgRole.ADMIN)
  create(
    @OrgId() orgId: string,
    @Body() body: { name: string; host: string; port: number; user: string; privateKey: string; os?: string },
  ) {
    return this.servers.createServer(orgId, body);
  }

  @Patch(':serverId')
  @Roles(OrgRole.ADMIN)
  update(
    @OrgId() orgId: string,
    @Param('serverId') serverId: string,
    @Body()
    body: {
      name?: string;
      host?: string;
      port?: number;
      user?: string;
      privateKey?: string;
      os?: string;
      previewPortMin?: number | null;
      previewPortMax?: number | null;
    },
  ) {
    return this.servers.updateServer(orgId, serverId, body);
  }

  @Post(':serverId/test')
  @Roles(OrgRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  test(@OrgId() orgId: string, @Param('serverId') serverId: string) {
    return this.servers.testConnection(orgId, serverId);
  }

  @Delete(':serverId')
  @Roles(OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@OrgId() orgId: string, @Param('serverId') serverId: string) {
    return this.servers.deleteServer(orgId, serverId);
  }
}
