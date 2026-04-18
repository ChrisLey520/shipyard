import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrgRole } from '@shipyard/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgId } from '../../common/decorators/current-user.decorator';
import { NotificationsCrudApplicationService } from './application/notifications-crud.application.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@ApiTags('通知配置')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs/:orgSlug/projects/:projectSlug/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsCrudApplicationService) {}

  @Get()
  @Roles(OrgRole.VIEWER)
  list(@OrgId() orgId: string, @Param('projectSlug') projectSlug: string) {
    return this.notifications.list(orgId, projectSlug);
  }

  @Post()
  @Roles(OrgRole.DEVELOPER)
  create(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Body() body: CreateNotificationDto,
  ) {
    return this.notifications.create(orgId, projectSlug, body);
  }

  @Patch(':notificationId')
  @Roles(OrgRole.DEVELOPER)
  update(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('notificationId') notificationId: string,
    @Body() body: UpdateNotificationDto,
  ) {
    return this.notifications.update(orgId, projectSlug, notificationId, body);
  }

  @Delete(':notificationId')
  @Roles(OrgRole.DEVELOPER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @OrgId() orgId: string,
    @Param('projectSlug') projectSlug: string,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notifications.remove(orgId, projectSlug, notificationId);
  }
}
