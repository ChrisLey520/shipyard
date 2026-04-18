import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PipelineModule } from '../pipeline/pipeline.module';
import { DeployModule } from '../deploy/deploy.module';

@Module({
  imports: [PipelineModule, DeployModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
