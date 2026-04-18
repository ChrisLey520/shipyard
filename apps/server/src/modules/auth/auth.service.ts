import { Injectable } from '@nestjs/common';
import { AuthApplicationService } from './application/auth.application.service';

export type { JwtPayload, TokenPair } from './domain/auth-session.types';

/**
 * 认证应用服务对外入口（兼容既有 AuthService 注入名）。
 * 业务逻辑在 {@link AuthApplicationService}。
 */
@Injectable()
export class AuthService extends AuthApplicationService {}
