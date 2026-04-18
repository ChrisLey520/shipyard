import { useAuthStore } from '@/stores/auth';

/** 邮箱密码登录（封装 store，满足页面不直接感知 HTTP 细节） */
export function useEmailLogin() {
  const auth = useAuthStore();

  async function loginWithEmailPassword(email: string, password: string): Promise<void> {
    await auth.login(email, password);
  }

  return { loginWithEmailPassword };
}
