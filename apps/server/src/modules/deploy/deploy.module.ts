import { Module } from '@nestjs/common';
import { DeployService } from './deploy.service';
import { DeployController } from './deploy.controller';
import { CryptoModule } from '../../common/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  providers: [DeployService],
  controllers: [DeployController],
  exports: [DeployService],
})
export class DeployModule {}
