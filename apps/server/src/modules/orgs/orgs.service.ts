import { Injectable } from '@nestjs/common';
import { OrgsApplicationService } from './application/orgs.application.service';

@Injectable()
export class OrgsService extends OrgsApplicationService {}
