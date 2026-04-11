import { Injectable } from '@nestjs/common';
import { GitOAuthApplicationService } from './application/git-oauth.application.service';

@Injectable()
export class GitOAuthService extends GitOAuthApplicationService {}
