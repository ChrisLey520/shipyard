import { Module } from '@nestjs/common';
import { GitController } from './git.controller';
import { GitService } from './git.service';
import { GitAccountsController } from './git-accounts.controller';
import { GitAccountsService } from './git-accounts.service';
import { GitOAuthService } from './git-oauth.service';
import { GitOAuthStartController } from './git-oauth-start.controller';
import { GitOAuthCallbackController } from './git-oauth-callback.controller';
import { GitAccessTokenService } from './git-access-token.service';
import { GitCommitStatusService } from './git-commit-status.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, CryptoModule, RedisModule],
  controllers: [
    GitController,
    GitAccountsController,
    GitOAuthStartController,
    GitOAuthCallbackController,
  ],
  providers: [
    GitService,
    GitAccountsService,
    GitOAuthService,
    GitAccessTokenService,
    GitCommitStatusService,
  ],
  exports: [GitService, GitAccountsService, GitAccessTokenService, GitCommitStatusService],
})
export class GitModule {}

