import { Controller, Post, Headers, RawBodyRequest, Req, Res, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Request } from 'express';
import { GitProvider } from '@shipyard/shared';
import { WebhooksService } from './webhooks.service';
import type { WebhooksGitProvider } from './webhook-types';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  private rawUtf8(req: RawBodyRequest<Request>): string {
    const b = req.rawBody;
    if (Buffer.isBuffer(b)) return b.toString('utf8');
    if (typeof b === 'string') return b;
    return '';
  }

  private async send(
    res: Response,
    provider: WebhooksGitProvider,
    p: string | undefined,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    const r = await this.webhooks.handleWebhook(provider, p, headers, rawBody);
    return res.status(r.status).json(r.body);
  }

  @Post('github')
  async githubWebhook(
    @Query('p') p: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    return this.send(res, GitProvider.GITHUB, p, headers, this.rawUtf8(req));
  }

  @Post('gitlab')
  async gitlabWebhook(
    @Query('p') p: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    return this.send(res, GitProvider.GITLAB, p, headers, this.rawUtf8(req));
  }

  @Post('gitee')
  async giteeWebhook(
    @Query('p') p: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    return this.send(res, GitProvider.GITEE, p, headers, this.rawUtf8(req));
  }

  @Post('gitea')
  async giteaWebhook(
    @Query('p') p: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    return this.send(res, GitProvider.GITEA, p, headers, this.rawUtf8(req));
  }
}
