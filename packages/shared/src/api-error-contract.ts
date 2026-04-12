import type { ErrorCode } from './error-codes';

/** 前端/小程序对接口失败时的呈现方式（可由服务端 errorDisplay 覆盖，或由调用方 shipyard.silent 等覆盖） */
export const apiErrorDisplays = ['message', 'modal', 'silent', 'redirect'] as const;
export type ApiErrorDisplay = (typeof apiErrorDisplays)[number];

export function isApiErrorDisplay(v: unknown): v is ApiErrorDisplay {
  return typeof v === 'string' && (apiErrorDisplays as readonly string[]).includes(v);
}

/** 对浏览器/小程序 fetch 路径：这些 401 不应触发 refresh，应按普通错误提示（如登录页展示密码错误） */
export const SHIPYARD_AUTH_PUBLIC_API_PREFIXES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
] as const;

/** apiPath 可为 `/auth/login`、相对路径或完整 URL */
export function isShipyardAuthPublicApiPath(apiPath: string): boolean {
  const trimmed = apiPath.trim();
  if (!trimmed) return false;

  let pathPart = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const schemeEnd = trimmed.indexOf('://');
    const pathStart = trimmed.indexOf('/', schemeEnd + 3);
    pathPart = pathStart >= 0 ? trimmed.slice(pathStart) : '/';
  }

  let p: string;
  if (pathPart.startsWith('/api/')) {
    p = pathPart.slice(4);
  } else if (pathPart === '/api') {
    p = '/';
  } else {
    p = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  }
  if (!p.startsWith('/')) p = `/${p}`;

  return (SHIPYARD_AUTH_PUBLIC_API_PREFIXES as readonly string[]).some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}

/** Nest / axios / uni 错误体常见形状（与 I18nHttpExceptionFilter 输出对齐） */
export type ShipyardApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  code?: string;
  errorDisplay?: ApiErrorDisplay;
  /** errorDisplay 为 redirect 时优先使用；否则由前端按场景默认 */
  redirectPath?: string;
};

export type ShipyardErrorResponse = {
  code: ErrorCode;
  message?: string;
  params?: Record<string, unknown>;
  errorDisplay?: ApiErrorDisplay;
  redirectPath?: string;
};

export function parseShipyardApiErrorBody(data: unknown): ShipyardApiErrorBody | null {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const o = data as Record<string, unknown>;
  const statusCode = typeof o['statusCode'] === 'number' ? o['statusCode'] : undefined;
  const message = o['message'];
  const code = typeof o['code'] === 'string' ? o['code'] : undefined;
  const ed = o['errorDisplay'];
  const redirectPath = typeof o['redirectPath'] === 'string' ? o['redirectPath'] : undefined;

  const normalizedMessage = Array.isArray(message)
    ? message.map((x) => String(x)).filter(Boolean)
    : typeof message === 'string'
      ? message
      : undefined;

  if (statusCode === undefined && normalizedMessage === undefined && code === undefined) {
    return null;
  }

  const out: ShipyardApiErrorBody = {};
  if (statusCode !== undefined) out.statusCode = statusCode;
  if (normalizedMessage !== undefined) out.message = normalizedMessage;
  if (code !== undefined) out.code = code;
  if (isApiErrorDisplay(ed)) out.errorDisplay = ed;
  if (redirectPath !== undefined) out.redirectPath = redirectPath;
  return out;
}

/** 从错误体取出可读文案 */
export function formatApiErrorMessage(body: ShipyardApiErrorBody | null, fallback = '请求失败'): string {
  if (!body?.message) return fallback;
  if (Array.isArray(body.message)) {
    const t = body.message.join('；').trim();
    return t || fallback;
  }
  const s = String(body.message).trim();
  return s || fallback;
}

export type ResolveApiErrorDisplayOptions = {
  /** 调用方强制静默（仍 reject Promise） */
  silent?: boolean;
  /** 调用方覆盖服务端与默认推断 */
  errorDisplay?: ApiErrorDisplay;
  /** 登录/注册等公开鉴权接口的 401，应提示文案而非跳转登录 */
  authPublic401?: boolean;
};

export function resolveApiErrorDisplay(
  httpStatus: number,
  body: ShipyardApiErrorBody | null,
  opts?: ResolveApiErrorDisplayOptions,
): ApiErrorDisplay {
  if (opts?.silent) return 'silent';
  if (opts?.errorDisplay) return opts.errorDisplay;
  if (body?.errorDisplay && isApiErrorDisplay(body.errorDisplay)) return body.errorDisplay;
  if (opts?.authPublic401 && httpStatus === 401) return 'message';
  if (httpStatus === 401) return 'redirect';
  if (httpStatus >= 500) return 'modal';
  return 'message';
}
