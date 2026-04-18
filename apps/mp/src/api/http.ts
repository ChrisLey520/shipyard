import { getApiBase } from '@/config/env';
import { isShipyardAuthPublicApiPath } from '@shipyard/shared';
import { reLaunchToLoginWithRedirect } from '@/utils/redirectLogin';
import { applyMpHttpErrorUi, applyMpNetworkErrorUi, type MpRequestShipyardMeta } from '@/utils/apiErrorUi';
import { storage } from '@/utils/storage';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
    /** 已处理跳转/会话清理，禁止再弹全局提示 */
    readonly skipGlobalUi = false,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface UniRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown>;
  header?: Record<string, string>;
  skipAuth?: boolean;
  _retry?: boolean;
  shipyard?: MpRequestShipyardMeta;
}

function joinUrl(path: string): string {
  const base = getApiBase();
  if (!base) {
    throw new HttpError(
      '未配置 VITE_API_BASE：请在 apps/mp 的 .env 中设置完整 API 根路径（如 https://host/api）',
    );
  }
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function shouldSkipAuthRefresh(opts: UniRequestOptions): boolean {
  if (opts.skipAuth) return true;
  if (opts.shipyard?.skipAuthRefresh) return true;
  return isShipyardAuthPublicApiPath(opts.url);
}

/** 无 401 拦截，用于 refresh */
export function rawRequest<T>(opts: UniRequestOptions): Promise<T> {
  const url = joinUrl(opts.url);
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: (opts.method ?? 'GET') as UniApp.RequestOptions['method'],
      data: opts.data,
      timeout: 60_000,
      header: {
        'Content-Type': 'application/json',
        ...opts.header,
      },
      success: (res) => {
        const code = res.statusCode ?? 0;
        if (code >= 200 && code < 300) {
          resolve((res.data ?? null) as T);
          return;
        }
        reject(new HttpError(`HTTP ${code}`, code, res.data));
      },
      fail: (err) => {
        reject(new HttpError(err.errMsg || '网络错误'));
      },
    });
  });
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  const rt = storage.getRefreshToken();
  if (!rt) return null;
  try {
    const pair = await rawRequest<{ accessToken: string; refreshToken: string }>({
      url: '/auth/refresh',
      method: 'POST',
      data: { refreshToken: rt },
      skipAuth: true,
      shipyard: { silent: true },
    });
    storage.setTokens(pair.accessToken, pair.refreshToken);
    return pair.accessToken;
  } catch {
    storage.clearTokens();
    return null;
  }
}

function uniRequestOnce<T>(opts: UniRequestOptions): Promise<T> {
  const headers: Record<string, string> = { ...opts.header };
  if (!opts.skipAuth) {
    const at = storage.getAccessToken();
    if (at) headers.Authorization = `Bearer ${at}`;
  }
  const url = joinUrl(opts.url);
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: (opts.method ?? 'GET') as UniApp.RequestOptions['method'],
      data: opts.data,
      timeout: 60_000,
      header: {
        'Content-Type': 'application/json',
        ...headers,
      },
      success: (res) => {
        const code = res.statusCode ?? 0;
        if (code >= 200 && code < 300) {
          resolve((res.data ?? null) as T);
          return;
        }
        reject(new HttpError(`HTTP ${code}`, code, res.data));
      },
      fail: (err) => {
        reject(new HttpError(err.errMsg || '网络错误'));
      },
    });
  });
}

export async function request<T>(opts: UniRequestOptions): Promise<T> {
  try {
    return await uniRequestOnce<T>(opts);
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(String(e));

    const canTryRefresh =
      err.statusCode === 401 &&
      !opts.skipAuth &&
      !opts._retry &&
      !shouldSkipAuthRefresh(opts);

    if (!canTryRefresh) {
      if (err.statusCode !== undefined) {
        applyMpHttpErrorUi(err, { url: opts.url, shipyard: opts.shipyard });
      } else {
        applyMpNetworkErrorUi(err.message);
      }
      throw err;
    }

    if (isRefreshing) {
      const token = await new Promise<string | null>((resolveQ) => {
        refreshQueue.push(resolveQ);
      });
      if (!token) {
        reLaunchToLoginWithRedirect();
        throw new HttpError('未授权', 401, undefined, true);
      }
      return request<T>({ ...opts, _retry: true });
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      if (!newToken) {
        reLaunchToLoginWithRedirect();
        throw new HttpError('未授权', 401, undefined, true);
      }
      return request<T>({ ...opts, _retry: true });
    } finally {
      isRefreshing = false;
    }
  }
}
