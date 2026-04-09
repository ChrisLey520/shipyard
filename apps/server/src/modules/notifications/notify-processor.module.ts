import { Module } from '@nestjs/common';
import { NotifyWorkerService } from './notify-worker.service';

@Module({
  providers: [NotifyWorkerService],
})
export class NotifyProcessorModule {}
