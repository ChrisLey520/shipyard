import { Injectable } from '@nestjs/common';
import { GitAccountsApplicationService } from './application/git-accounts.application.service';

@Injectable()
export class GitAccountsService extends GitAccountsApplicationService {}
