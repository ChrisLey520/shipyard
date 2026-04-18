import { authApi } from '@/api/auth';
import { usersApi } from '@/api/users';

/** 个人设置相关的远端调用（头像、改密），供页面与 store 组合使用 */
export function usePersonalProfileApi() {
  async function uploadAvatar(file: File) {
    return usersApi.uploadMyAvatar(file);
  }

  async function changePassword(oldPassword: string, newPassword: string) {
    await authApi.changePassword(oldPassword, newPassword);
  }

  return { uploadAvatar, changePassword };
}
