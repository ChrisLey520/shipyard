import { Injectable } from '@nestjs/common';
import { WebhooksApplicationService } from './application/webhooks.application.service';

@Injectable()
export class WebhooksService extends WebhooksApplicationService {}
