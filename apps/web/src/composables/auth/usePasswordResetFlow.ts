import { authApi } from '@/api/auth';

/** 忘记密码 / 重置密码（页面通过 composable 调用，不直接依赖 authApi） */
export function usePasswordResetFlow() {
  async function requestResetEmail(email: string): Promise<void> {
    await authApi.forgotPassword(email);
  }

  async function confirmResetPassword(token: string, newPassword: string): Promise<void> {
    await authApi.resetPassword(token, newPassword);
  }

  return { requestResetEmail, confirmResetPassword };
}
