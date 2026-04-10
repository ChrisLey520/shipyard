import { http } from './client';
import type { SupportedLocale } from '../i18n';

export const usersApi = {
  uploadMyAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<{ avatarUrl: string }>('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  updateMyLocale: (locale: SupportedLocale) =>
    http.patch<{ locale: SupportedLocale }>('/users/me', { locale }).then((r) => r.data),
};

