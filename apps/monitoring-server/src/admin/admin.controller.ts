import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';

@Controller('v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('events')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async list(
    @Headers('x-admin-token') adminToken: string | undefined,
    @Query('projectKey') projectKey?: string,
    @Query('platform') platform?: string,
    @Query('release') release?: string,
    @Query('route') route?: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.admin.list({
      token: adminToken,
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
      ...(projectKey !== undefined ? { projectKey } : {}),
      ...(platform !== undefined ? { platform } : {}),
      ...(release !== undefined ? { release } : {}),
      ...(route !== undefined ? { route } : {}),
      ...(type !== undefined ? { type } : {}),
    });
  }

  @Get('events/:id')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async detail(@Headers('x-admin-token') adminToken: string | undefined, @Param('id') id: string) {
    return this.admin.getById(adminToken, id);
  }

  @Get('projects')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async projects(@Headers('x-admin-token') adminToken: string | undefined) {
    return this.admin.listProjects(adminToken);
  }

  @Post('projects')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async createProject(
    @Headers('x-admin-token') adminToken: string | undefined,
    @Body() body: { projectKey?: string },
  ) {
    return this.admin.createProject(adminToken, body.projectKey ?? '');
  }

  @Post('projects/:id/rotate-token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async rotateToken(@Headers('x-admin-token') adminToken: string | undefined, @Param('id') id: string) {
    return this.admin.rotateIngestToken(adminToken, id);
  }

  @Get('metrics/hourly')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async hourlyMetrics(
    @Headers('x-admin-token') adminToken: string | undefined,
    @Query('projectKey') projectKey: string,
    @Query('days') days = '7',
    @Query('type') type?: string,
    @Query('release') release?: string,
  ) {
    return this.admin.hourlyMetrics(adminToken, {
      projectKey,
      days: parseInt(days, 10) || 7,
      ...(type !== undefined ? { type } : {}),
      ...(release !== undefined ? { release } : {}),
    });
  }

  @Get('alert-rules')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async listAlerts(
    @Headers('x-admin-token') adminToken: string | undefined,
    @Query('projectKey') projectKey?: string,
  ) {
    return this.admin.listAlertRules(adminToken, projectKey);
  }

  @Post('alert-rules')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async createAlert(@Headers('x-admin-token') adminToken: string | undefined, @Body() body: unknown) {
    return this.admin.createAlertRule(adminToken, body);
  }
}
