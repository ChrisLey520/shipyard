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
import { IsIn, IsOptional, IsString } from 'class-validator';
import { supportedLocales, USER_COLOR_MODES, USER_THEME_IDS } from '@shipyard/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';
import { UsersApplicationService } from './application/users.application.service';

const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');

function ensureAvatarDir() {
  mkdirSync(AVATAR_DIR, { recursive: true });
}

class UpdateMeBody {
  @IsOptional()
  @IsString()
  @IsIn([...supportedLocales])
  locale?: string;

  @IsOptional()
  @IsString()
  @IsIn([...USER_THEME_IDS])
  themeId?: string;

  @IsOptional()
  @IsString()
  @IsIn([...USER_COLOR_MODES])
  colorMode?: string;
}

@ApiTags('用户')
@Controller('users')
export class UsersController {
  constructor(private readonly usersApplication: UsersApplicationService) {}

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新当前用户偏好（语言 / 主题色调 / 深浅模式，至少一项）' })
  async updateMe(@CurrentUser() user: User, @Body() body: UpdateMeBody) {
    const has =
      body.locale !== undefined || body.themeId !== undefined || body.colorMode !== undefined;
    if (!has) {
      throw new BadRequestException('请至少提供 locale、themeId、colorMode 之一');
    }
    return this.usersApplication.updateMe(user.id, {
      locale: body.locale,
      themeId: body.themeId,
      colorMode: body.colorMode,
    });
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
