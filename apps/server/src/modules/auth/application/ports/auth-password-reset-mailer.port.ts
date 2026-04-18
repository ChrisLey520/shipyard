/** 忘记密码邮件发送端口 */
export interface AuthPasswordResetMailer {
  sendPasswordReset(to: string, token: string): Promise<void>;
}

export const AUTH_PASSWORD_RESET_MAILER = Symbol('AUTH_PASSWORD_RESET_MAILER');
