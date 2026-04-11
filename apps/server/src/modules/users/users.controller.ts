import {
  BadRequestException,
  Controller,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import type { Request } from 'express';
import { IsIn, IsString } from 'class-validator';
import { supportedLocales } from '@shipyard/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';
import { UsersApplicationService } from './application/users.application.service';

const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');

function ensureAvatarDir() {
  mkdirSync(AVATAR_DIR, { recursive: true });
}

class UpdateMeBody {
  @IsString()
  @IsIn([...supportedLocales])
  locale!: string;
}

@ApiTags('用户')
@Controller('users')
export class UsersController {
  constructor(private readonly usersApplication: UsersApplicationService) {}

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新当前用户信息（语言）' })
  async updateMe(@CurrentUser() user: User, @Body() body: UpdateMeBody) {
    return this.usersApplication.updateLocale(user.id, body.locale);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传当前用户头像' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new Error('仅支持 jpg/png/webp'), ok);
      },
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
          ensureAvatarDir();
          cb(null, AVATAR_DIR);
        },
        filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const safeExt = ext && ext.length <= 10 ? ext : '';
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
    }),
  )
  async uploadMyAvatar(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');

    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.usersApplication.setAvatarUrl(user.id, avatarUrl);
  }
}
