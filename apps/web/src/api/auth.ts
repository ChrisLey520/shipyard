import { http } from './client';

const authFormShipyard = { silent: true, skipAuthRefresh: true } as const;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  locale?: string | null;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    http.post<TokenPair>('/auth/register', data, { shipyard: authFormShipyard }).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    http.post<TokenPair>('/auth/login', data, { shipyard: authFormShipyard }).then((r) => r.data),

  logout: (refreshToken: string) =>
    http.post('/auth/logout', { refreshToken }, { shipyard: { silent: true } }),

  refresh: (refreshToken: string) =>
    http
      .post<TokenPair>('/auth/refresh', { refreshToken }, { shipyard: { silent: true } })
      .then((r) => r.data),

  me: () =>
    http.get<User>('/auth/me').then((r) => r.data),

  forgotPassword: (email: string) =>
    http.post('/auth/forgot-password', { email }, { shipyard: authFormShipyard }),

  resetPassword: (token: string, password: string) =>
    http.post('/auth/reset-password', { token, password }, { shipyard: authFormShipyard }),

  changePassword: (oldPassword: string, newPassword: string) =>
    http.post(
      '/auth/change-password',
      { oldPassword, newPassword },
      { shipyard: { silent: true } },
    ),
};
