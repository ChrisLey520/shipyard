import { Injectable } from '@nestjs/common';
import { PipelineApplicationService } from './application/pipeline.application.service';

export type { BuildJobData } from './application/pipeline.application.service';

@Injectable()
export class PipelineService extends PipelineApplicationService {}
