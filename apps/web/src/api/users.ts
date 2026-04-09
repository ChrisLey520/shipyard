import { http } from './client';

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
};

