/** 认证会话与 JWT 载荷（领域无关 IO 的纯类型） */
export interface JwtPayload {
  sub: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
