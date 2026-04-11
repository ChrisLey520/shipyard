import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { buildFeishuSignedWebhookUrl } from './feishu-webhook-sign';
import { buildSlackOptionalHeaders } from './slack-webhook-headers';

describe('飞书 Webhook 加签', () => {
  it('追加 timestamp（秒）与 sign 查询参数', () => {
    const nowMs = 1_700_000_000_000;
    const href = buildFeishuSignedWebhookUrl(
      'https://open.feishu.cn/open-apis/bot/v2/hook/abc',
      'mysecret',
      nowMs,
    );
    const u = new URL(href);
    expect(u.searchParams.get('timestamp')).toBe(String(Math.floor(nowMs / 1000)));
    const ts = u.searchParams.get('timestamp')!;
    const sign = u.searchParams.get('sign');
    expect(sign).toBeTruthy();
    const expected = createHmac('sha256', 'mysecret').update(`${ts}\nmysecret`).digest('base64');
    expect(sign).toBe(expected);
  });
});

describe('Slack 可选 Authorization', () => {
  it('无 secret 时返回 undefined', () => {
    expect(buildSlackOptionalHeaders(undefined)).toBeUndefined();
    expect(buildSlackOptionalHeaders('')).toBeUndefined();
  });
  it('有 secret 时生成 Bearer', () => {
    expect(buildSlackOptionalHeaders(' tok ')).toEqual({ Authorization: 'Bearer tok' });
  });
});
