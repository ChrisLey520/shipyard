import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Express } from 'express';
import { SourcemapsService } from './sourcemaps.service';

@Controller('v1/sourcemaps')
export class SourcemapsController {
  constructor(private readonly sourcemaps: SourcemapsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @Headers('authorization') authorization: string | undefined,
    @Body('release') release: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file');
    }
    if (!release?.trim()) {
      throw new BadRequestException('Missing release');
    }
    return this.sourcemaps.upload({
      authorization,
      release,
      buffer: file.buffer,
      originalName: file.originalname,
    });
  }
}
