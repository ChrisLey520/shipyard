import { createHmac } from 'crypto';

/**
 * 飞书自定义机器人「签名校验」：对 timestamp + "\n" + 密钥 做 HMAC-SHA256 后 Base64，
 * 作为 sign 查询参数（timestamp 为 Unix 秒，与开放平台文档一致）。
 */
export function buildFeishuSignedWebhookUrl(
  webhookUrl: string,
  secretPlain: string,
  nowMs?: number,
): string {
  const timestamp = String(Math.floor((nowMs ?? Date.now()) / 1000));
  const stringToSign = `${timestamp}\n${secretPlain}`;
  const sign = createHmac('sha256', secretPlain).update(stringToSign).digest('base64');
  const u = new URL(webhookUrl);
  u.searchParams.set('timestamp', timestamp);
  u.searchParams.set('sign', sign);
  return u.href;
}
