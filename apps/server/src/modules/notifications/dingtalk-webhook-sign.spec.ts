import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';

/** 与 NotifyWorkerApplicationService.buildDingtalkSignedWebhookUrl 算法一致（单测避免反射私有方法） */
function buildDingtalkSignedWebhookUrl(webhookUrl: string, secretPlain: string, timestamp: number): string {
  const stringToSign = `${timestamp}\n${secretPlain}`;
  const sign = createHmac('sha256', secretPlain).update(stringToSign).digest('base64');
  const u = new URL(webhookUrl);
  u.searchParams.set('timestamp', String(timestamp));
  u.searchParams.set('sign', sign);
  return u.href;
}

describe('钉钉 Webhook 加签', () => {
  it('追加 timestamp 与 sign 查询参数', () => {
    const ts = 1_700_000_000_000;
    const href = buildDingtalkSignedWebhookUrl(
      'https://oapi.dingtalk.com/robot/send?access_token=abc',
      'SECtest',
      ts,
    );
    const u = new URL(href);
    expect(u.searchParams.get('access_token')).toBe('abc');
    expect(u.searchParams.get('timestamp')).toBe(String(ts));
    const sign = u.searchParams.get('sign');
    expect(sign).toBeTruthy();
    const expected = createHmac('sha256', 'SECtest').update(`${ts}\nSECtest`).digest('base64');
    expect(sign).toBe(expected);
  });
});
