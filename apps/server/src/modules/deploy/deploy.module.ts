import { Module } from '@nestjs/common';
import { DeployService } from './deploy.service';
import { DeployController } from './deploy.controller';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { GitModule } from '../git/git.module';

@Module({
  imports: [CryptoModule, GitModule],
  providers: [DeployService],
  controllers: [DeployController],
  exports: [DeployService],
})
export class DeployModule {}
