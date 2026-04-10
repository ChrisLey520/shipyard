import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GitOAuthService } from './git-oauth.service';

@ApiTags('Git OAuth')
@Controller('git/oauth')
export class GitOAuthCallbackController {
  constructor(private readonly oauth: GitOAuthService) {}

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.oauth.completeCallback(provider, code, state);
    res.redirect(302, url);
  }
}
