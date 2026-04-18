import { Injectable } from '@nestjs/common';
import { GitAccessTokenApplicationService } from './application/git-access-token.application.service';

@Injectable()
export class GitAccessTokenService extends GitAccessTokenApplicationService {}
