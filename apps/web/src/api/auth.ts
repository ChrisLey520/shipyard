import { http } from './client';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    http.post<TokenPair>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    http.post<TokenPair>('/auth/login', data).then((r) => r.data),

  logout: (refreshToken: string) =>
    http.post('/auth/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    http.post<TokenPair>('/auth/refresh', { refreshToken }).then((r) => r.data),

  me: () =>
    http.get<User>('/auth/me').then((r) => r.data),

  forgotPassword: (email: string) =>
    http.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    http.post('/auth/reset-password', { token, password }),

  changePassword: (oldPassword: string, newPassword: string) =>
    http.post('/auth/change-password', { oldPassword, newPassword }),
};
