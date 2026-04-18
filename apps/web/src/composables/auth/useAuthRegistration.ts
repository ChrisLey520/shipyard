import { useAuthStore } from '@/stores/auth';

/** 注册：经 Pinia auth，避免页面直接拼装 API */
export function useAuthRegistration() {
  const auth = useAuthStore();

  async function registerAccount(name: string, email: string, password: string): Promise<void> {
    await auth.register(name, email, password);
  }

  return { registerAccount };
}
