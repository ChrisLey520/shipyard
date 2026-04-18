const DEFAULT_DENY = new Set([
  'password',
  'passwd',
  'token',
  'authorization',
  'cookie',
  'cookies',
  'secret',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
]);

const MAX_DEPTH = 8;
const MAX_KEYS = 64;
const MAX_STRING = 2048;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** 浅层复制并脱敏，用于事件 payload / breadcrumb */
export function sanitizeValue(
  value: unknown,
  extraDenyKeys: string[],
  depth = 0,
  keyCount: { n: number } = { n: 0 },
): unknown {
  if (depth > MAX_DEPTH) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 32).map((x) => sanitizeValue(x, extraDenyKeys, depth + 1, keyCount));
  }
  if (!isPlainObject(value)) return String(value);

  const deny = new Set([...DEFAULT_DENY, ...extraDenyKeys.map((k) => k.toLowerCase())]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (keyCount.n >= MAX_KEYS) {
      out['_truncatedKeys'] = true;
      break;
    }
    keyCount.n += 1;
    if (deny.has(k.toLowerCase())) {
      out[k] = '[Redacted]';
      continue;
    }
    out[k] = sanitizeValue(v, extraDenyKeys, depth + 1, keyCount);
  }
  return out;
}

/** 脱敏 URL：去掉 query */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url, 'http://local');
    u.search = '';
    if (u.origin === 'http://local') return u.pathname || url;
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.slice(0, 512);
  }
}
