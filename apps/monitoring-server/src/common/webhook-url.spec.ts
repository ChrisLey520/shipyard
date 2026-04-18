import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertPublicWebhookUrl, webhookAllowInsecureLocal } from './webhook-url';

describe('assertPublicWebhookUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('允许 https 公网域名', () => {
    expect(() => assertPublicWebhookUrl('https://hooks.example.com/path', false)).not.toThrow();
  });

  it('拒绝非 https（未开本地 http 放行）', () => {
    expect(() => assertPublicWebhookUrl('http://hooks.example.com/hook', false)).toThrow(BadRequestException);
  });

  it('allowHttpLocal 为 true 时允许 http 公网', () => {
    expect(() => assertPublicWebhookUrl('http://hooks.example.com/hook', true)).not.toThrow();
  });

  it('拒绝 localhost', () => {
    expect(() => assertPublicWebhookUrl('https://localhost/x', false)).toThrow(BadRequestException);
  });

  it('拒绝私网 IPv4', () => {
    expect(() => assertPublicWebhookUrl('https://10.0.0.1/x', false)).toThrow(BadRequestException);
  });

  it('拒绝 .local 域名', () => {
    expect(() => assertPublicWebhookUrl('https://foo.local/x', false)).toThrow(BadRequestException);
  });

  it('非法 URL 抛 BadRequestException', () => {
    expect(() => assertPublicWebhookUrl('not-a-url', false)).toThrow(BadRequestException);
  });
});

describe('webhookAllowInsecureLocal', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('环境变量为 true 时返回 true', () => {
    vi.stubEnv('MONITORING_WEBHOOK_ALLOW_HTTP_LOCAL', 'true');
    expect(webhookAllowInsecureLocal()).toBe(true);
  });
});
