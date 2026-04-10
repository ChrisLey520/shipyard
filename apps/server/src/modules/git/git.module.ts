import { Module } from '@nestjs/common';
import { GitController } from './git.controller';
import { GitService } from './git.service';
import { GitAccountsController } from './git-accounts.controller';
import { GitAccountsService } from './git-accounts.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CryptoModule } from '../../common/crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [GitController, GitAccountsController],
  providers: [GitService, GitAccountsService],
})
export class GitModule {}

