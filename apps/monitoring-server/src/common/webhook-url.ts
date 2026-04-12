import { BadRequestException } from '@nestjs/common';

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isPrivateIpv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split('.').map((x) => parseInt(x, 10));
  if (parts.some((n) => Number.isNaN(n) || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** 告警 Webhook URL 基础 SSRF 防护（内网 / 元数据地址拒绝） */
export function assertPublicWebhookUrl(urlStr: string, allowHttpLocal: boolean): void {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw new BadRequestException('Invalid webhook URL');
  }
  if (u.protocol !== 'https:' && !(allowHttpLocal && u.protocol === 'http:')) {
    throw new BadRequestException('Webhook URL must use https (http allowed only in dev with flag)');
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new BadRequestException('Webhook host not allowed');
  }
  if (host.endsWith('.local')) {
    throw new BadRequestException('Webhook host not allowed');
  }
  if (isPrivateIpv4(host)) {
    throw new BadRequestException('Private IPv4 not allowed for webhook');
  }
}

export function webhookAllowInsecureLocal(): boolean {
  return process.env['MONITORING_WEBHOOK_ALLOW_HTTP_LOCAL'] === 'true';
}
