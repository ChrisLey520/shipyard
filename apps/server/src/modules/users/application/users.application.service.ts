import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/** 用户资料与偏好（与认证凭证上下文分离的应用层） */
@Injectable()
export class UsersApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async updateLocale(userId: string, locale: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { locale },
      select: { locale: true },
    });
  }

  async setAvatarUrl(userId: string, avatarUrl: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true },
    });
    return { avatarUrl };
  }
}
