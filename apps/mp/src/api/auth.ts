import { rawRequest, request } from './http';

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
    request<TokenPair>({ url: '/auth/register', method: 'POST', data }),

  login: (data: { email: string; password: string }) =>
    request<TokenPair>({ url: '/auth/login', method: 'POST', data }),

  refresh: (rt: string) =>
    rawRequest<TokenPair>({ url: '/auth/refresh', method: 'POST', data: { refreshToken: rt } }),

  logout: (refreshToken: string) =>
    request<unknown>({ url: '/auth/logout', method: 'POST', data: { refreshToken } }),

  me: () => request<AuthUser>({ url: '/auth/me' }),

  forgotPassword: (email: string) =>
    request<unknown>({ url: '/auth/forgot-password', method: 'POST', data: { email } }),

  resetPassword: (token: string, password: string) =>
    request<unknown>({ url: '/auth/reset-password', method: 'POST', data: { token, password } }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<unknown>({
      url: '/auth/change-password',
      method: 'POST',
      data: { oldPassword, newPassword },
    }),
};
