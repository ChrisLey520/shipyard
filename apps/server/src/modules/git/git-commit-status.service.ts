import { Injectable } from '@nestjs/common';
import { GitCommitStatusApplicationService } from './application/git-commit-status.application.service';

export type { CommitStatusPhase, GithubCommitState } from './application/git-commit-status.application.service';

@Injectable()
export class GitCommitStatusService extends GitCommitStatusApplicationService {}
