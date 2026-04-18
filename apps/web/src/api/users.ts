import { http } from './client';
import type { SupportedLocale } from '../i18n';
import type { UserColorMode, UserThemeId } from '@shipyard/shared';

export type UpdateMeBody = {
  locale?: SupportedLocale;
  themeId?: UserThemeId;
  colorMode?: UserColorMode;
};

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

  updateMe: (body: UpdateMeBody) =>
    http.patch<Partial<{ locale: string; themeId: string; colorMode: string }>>('/users/me', body).then((r) => r.data),

  updateMyLocale: (locale: SupportedLocale) => usersApi.updateMe({ locale }),
};

