import { rawRequest, request } from './http';

/** 公开鉴权：不 refresh；错误由 request 全局 UI 展示（与 Web axios 对齐） */
const authPublicShipyard = { skipAuthRefresh: true } as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  locale?: string | null;
  themeId?: string | null;
  colorMode?: string | null;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<TokenPair>({ url: '/auth/register', method: 'POST', data, shipyard: authPublicShipyard }),

  login: (data: { email: string; password: string }) =>
    request<TokenPair>({ url: '/auth/login', method: 'POST', data, shipyard: authPublicShipyard }),

  refresh: (rt: string) =>
    rawRequest<TokenPair>({
      url: '/auth/refresh',
      method: 'POST',
      data: { refreshToken: rt },
      skipAuth: true,
    }),

  logout: (refreshToken: string) =>
    request<unknown>({
      url: '/auth/logout',
      method: 'POST',
      data: { refreshToken },
      shipyard: { silent: true },
    }),

  me: () => request<AuthUser>({ url: '/auth/me' }),

  forgotPassword: (email: string) =>
    request<unknown>({
      url: '/auth/forgot-password',
      method: 'POST',
      data: { email },
      shipyard: authPublicShipyard,
    }),

  resetPassword: (token: string, password: string) =>
    request<unknown>({
      url: '/auth/reset-password',
      method: 'POST',
      data: { token, password },
      shipyard: authPublicShipyard,
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<unknown>({
      url: '/auth/change-password',
      method: 'POST',
      data: { oldPassword, newPassword },
    }),
};
