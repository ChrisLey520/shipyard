import { Module } from '@nestjs/common';
import { AlertEvaluatorService } from './alert-evaluator.service';
import { RetentionService } from './retention.service';

@Module({
  providers: [RetentionService, AlertEvaluatorService],
})
export class JobsModule {}
