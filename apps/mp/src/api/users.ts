import type { UserColorMode, UserThemeId } from '@shipyard/shared';
import { getApiBase } from '@/config/env';
import { storage } from '@/utils/storage';
import { HttpError, request } from './http';

export type UpdateMeBody = {
  locale?: string;
  themeId?: UserThemeId;
  colorMode?: UserColorMode;
};

export async function updateMe(body: UpdateMeBody) {
  return request<Partial<{ locale: string; themeId: string; colorMode: string }>>({
    url: '/users/me',
    method: 'PATCH',
    data: body,
  });
}

export async function updateMyLocale(locale: string) {
  return updateMe({ locale });
}

/** 小程序使用本地临时路径上传头像（chooseImage 的 tempFilePaths） */
export function uploadMyAvatar(filePath: string): Promise<{ avatarUrl: string }> {
  const base = getApiBase();
  if (!base) {
    return Promise.reject(
      new HttpError('未配置 VITE_API_BASE：无法上传文件'),
    );
  }
  const token = storage.getAccessToken();
  if (!token) {
    return Promise.reject(new HttpError('未登录'));
  }
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${base}/users/me/avatar`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success: (res) => {
        const code = res.statusCode ?? 0;
        const raw = typeof res.data === 'string' ? res.data : '';
        if (code >= 200 && code < 300) {
          try {
            const data = JSON.parse(raw || '{}') as { avatarUrl?: string };
            if (data.avatarUrl) {
              resolve({ avatarUrl: data.avatarUrl });
              return;
            }
          } catch {
            /* fallthrough */
          }
          reject(new HttpError('上传响应无效', code));
          return;
        }
        let msg = `HTTP ${code}`;
        try {
          const body = JSON.parse(raw || '{}') as { message?: string };
          if (body.message) msg = body.message;
        } catch {
          /* ignore */
        }
        reject(new HttpError(msg, code));
      },
      fail: (err) => {
        reject(new HttpError(err.errMsg || '上传失败'));
      },
    });
  });
}
