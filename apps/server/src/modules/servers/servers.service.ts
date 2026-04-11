import { Injectable } from '@nestjs/common';
import { ServersApplicationService } from './application/servers.application.service';

@Injectable()
export class ServersService extends ServersApplicationService {}
