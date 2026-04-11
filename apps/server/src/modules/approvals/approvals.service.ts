import { Injectable } from '@nestjs/common';
import { ApprovalsApplicationService } from './application/approvals.application.service';

@Injectable()
export class ApprovalsService extends ApprovalsApplicationService {}
