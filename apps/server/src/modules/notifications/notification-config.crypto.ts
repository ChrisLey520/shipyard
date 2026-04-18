import { BadRequestException } from '@nestjs/common';
import { NotificationChannel } from '@shipyard/shared';
import type { CryptoService } from '../../common/crypto/crypto.service';

/** 按渠道持久化前需加密的 config 键 */
export const NOTIFICATION_SENSITIVE_KEYS: Record<NotificationChannel, string[]> = {
  [NotificationChannel.WEBHOOK]: ['secret'],
  [NotificationChannel.EMAIL]: ['smtpPass'],
  [NotificationChannel.FEISHU]: ['secret'],
  [NotificationChannel.DINGTALK]: ['secret'],
  [NotificationChannel.SLACK]: ['secret'],
  [NotificationChannel.WECOM]: ['secret'],
};

const KEEP_SENTINEL = '__keep__';

function sensitiveKeys(channel: string): string[] {
  return NOTIFICATION_SENSITIVE_KEYS[channel as NotificationChannel] ?? [];
}

/** 创建 / 合并更新后的完整 config 校验 */
export function assertValidNotificationConfig(channel: string, config: Record<string, unknown>): void {
  const c = config;
  switch (channel) {
    case NotificationChannel.WEBHOOK:
    case NotificationChannel.FEISHU:
    case NotificationChannel.DINGTALK:
    case NotificationChannel.SLACK:
    case NotificationChannel.WECOM: {
      const url = c['url'];
      if (typeof url !== 'string' || !url.trim()) {
        throw new BadRequestException('config.url 为必填非空字符串');
      }
      try {
        new URL(url);
      } catch {
        throw new BadRequestException('config.url 不是合法 URL');
      }
      break;
    }
    case NotificationChannel.EMAIL: {
      const host = c['smtpHost'];
      const port = c['smtpPort'];
      const user = c['smtpUser'];
      const from = c['from'];
      if (typeof host !== 'string' || !host.trim()) {
        throw new BadRequestException('config.smtpHost 为必填');
      }
      const n = typeof port === 'number' ? port : Number(port);
      if (!Number.isFinite(n) || n < 1 || n > 65535) {
        throw new BadRequestException('config.smtpPort 须为 1–65535');
      }
      if (typeof user !== 'string' || !user.trim()) {
        throw new BadRequestException('config.smtpUser 为必填');
      }
      if (typeof from !== 'string' || !from.trim()) {
        throw new BadRequestException('config.from 为必填');
      }
      break;
    }
    default:
      throw new BadRequestException(`不支持的 channel: ${channel}`);
  }
}

export function decryptNotificationSecrets(
  crypto: CryptoService,
  channel: string,
  stored: Record<string, unknown>,
): Record<string, unknown> {
  const keys = sensitiveKeys(channel);
  const out = { ...stored };
  for (const k of keys) {
    const v = out[k];
    if (typeof v !== 'string' || !v) continue;
    try {
      out[k] = crypto.decrypt(v);
    } catch {
      // 兼容未加密的旧数据
    }
  }
  return out;
}

/** 明文 config → 入库 JSON（敏感字段加密） */
export function toPersistedNotificationConfig(
  crypto: CryptoService,
  channel: NotificationChannel,
  plain: Record<string, unknown>,
): Record<string, unknown> {
  const keys = sensitiveKeys(channel);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(plain)) {
    if (v === undefined) continue;
    if (keys.includes(k)) {
      if (typeof v === 'string' && v.length > 0) {
        out[k] = crypto.encrypt(v);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** API 响应：不返回明文密钥，用 *Configured 标记 */
export function sanitizeNotificationConfigForApi(
  channel: string,
  decrypted: Record<string, unknown>,
): Record<string, unknown> {
  const keys = sensitiveKeys(channel);
  const out = { ...decrypted };
  for (const k of keys) {
    const v = out[k];
    if (v != null && String(v).trim() !== '') {
      delete out[k];
      if (k === 'smtpPass') {
        out['smtpPassConfigured'] = true;
      } else {
        out['secretConfigured'] = true;
      }
    }
  }
  return out;
}

/** 合并 PATCH：空串与 __keep__ 表示保留原敏感字段 */
export function mergeNotificationConfigForUpdate(
  crypto: CryptoService,
  channel: NotificationChannel,
  prevStored: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const prevPlain = decryptNotificationSecrets(crypto, channel, prevStored);
  if (!incoming || Object.keys(incoming).length === 0) {
    return prevPlain;
  }
  const sens = new Set(sensitiveKeys(channel));
  const next = { ...prevPlain };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (sens.has(k)) {
      if (v === '' || v === KEEP_SENTINEL) continue;
    }
    next[k] = v;
  }
  return next;
}
