import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsApplicationService } from './application/feature-flags.application.service';

@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsApplicationService],
  exports: [FeatureFlagsApplicationService],
})
export class FeatureFlagsModule {}
