import { Injectable } from '@nestjs/common';
import { EnvironmentsApplicationService } from './application/environments.application.service';

@Injectable()
export class EnvironmentsService extends EnvironmentsApplicationService {}
