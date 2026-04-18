import { Injectable } from '@nestjs/common';
import { DeployApplicationService } from './application/deploy.application.service';

@Injectable()
export class DeployService extends DeployApplicationService {}
