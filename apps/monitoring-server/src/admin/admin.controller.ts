import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
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
}
