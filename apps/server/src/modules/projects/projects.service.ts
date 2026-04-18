import { Injectable } from '@nestjs/common';
import { ProjectsApplicationService } from './application/projects.application.service';

/**
 * 项目上下文应用服务对外入口（与控制器注入名兼容）。
 */
@Injectable()
export class ProjectsService extends ProjectsApplicationService {}
