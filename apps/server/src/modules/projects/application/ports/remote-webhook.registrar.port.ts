/** 远端 Git 平台 Webhook 注册/注销端口（HTTP 实现在 infrastructure） */

export const REMOTE_WEBHOOK_REGISTRAR = Symbol('REMOTE_WEBHOOK_REGISTRAR');

export interface RemoteWebhookRegistrar {
  registerForProvider(opts: {
    projectId: string;
    gitProvider: string;
    repoFullName: string;
    accessToken: string;
    baseUrl: string | null;
    webhookSecret: string;
  }): Promise<{ remoteWebhookId: string } | null>;

  unregisterForProvider(opts: {
    gitProvider: string;
    repoFullName: string;
    accessToken: string;
    baseUrl: string | null;
    remoteWebhookId: string;
  }): Promise<void>;
}
