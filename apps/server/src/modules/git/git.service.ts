import { Injectable } from '@nestjs/common';
import { GitApplicationService } from './application/git.application.service';

@Injectable()
export class GitService extends GitApplicationService {}
