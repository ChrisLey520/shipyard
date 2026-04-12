import { rawRequest, request } from './http';

const authFormShipyard = { silent: true, skipAuthRefresh: true } as const;

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
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<TokenPair>({ url: '/auth/register', method: 'POST', data, shipyard: authFormShipyard }),

  login: (data: { email: string; password: string }) =>
    request<TokenPair>({ url: '/auth/login', method: 'POST', data, shipyard: authFormShipyard }),

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
      shipyard: authFormShipyard,
    }),

  resetPassword: (token: string, password: string) =>
    request<unknown>({
      url: '/auth/reset-password',
      method: 'POST',
      data: { token, password },
      shipyard: authFormShipyard,
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<unknown>({
      url: '/auth/change-password',
      method: 'POST',
      data: { oldPassword, newPassword },
      shipyard: { silent: true },
    }),
};
