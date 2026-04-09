import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

class RegisterBody {
  name!: string;
  email!: string;
  password!: string;
}

class LoginBody {
  email!: string;
  password!: string;
}

class RefreshBody {
  refreshToken!: string;
}

class ForgotPasswordBody {
  email!: string;
}

class ResetPasswordBody {
  token!: string;
  password!: string;
}

class ChangePasswordBody {
  oldPassword!: string;
  newPassword!: string;
}

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '注册' })
  async register(@Body() body: RegisterBody) {
    return this.authService.register(body.name, body.email, body.password);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录' })
  async login(@Body() body: LoginBody) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Token' })
  async refresh(@Body() body: RefreshBody) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '登出' })
  async logout(@Body() body: RefreshBody) {
    await this.authService.logout(body.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '忘记密码（发送重置邮件）' })
  async forgotPassword(@Body() body: ForgotPasswordBody) {
    await this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '重置密码' })
  async resetPassword(@Body() body: ResetPasswordBody) {
    await this.authService.resetPassword(body.token, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  async me(@CurrentUser() user: User) {
    return this.authService.getUserById(user.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '修改密码' })
  async changePassword(@CurrentUser() user: User, @Body() body: ChangePasswordBody) {
    await this.authService.changePassword(user.id, body.oldPassword, body.newPassword);
  }
}
