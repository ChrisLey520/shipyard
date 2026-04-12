import { getApiBase } from '@/config/env';
import { storage } from '@/utils/storage';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

interface UniRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown>;
  header?: Record<string, string>;
  skipAuth?: boolean;
  _retry?: boolean;
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

/** 无 401 拦截，用于 refresh */
export function rawRequest<T>(opts: UniRequestOptions): Promise<T> {
  const url = joinUrl(opts.url);
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      // uni-app 类型定义未包含 PATCH，运行时各端支持情况以官方文档为准
      method: (opts.method ?? 'GET') as UniApp.RequestOptions['method'],
      data: opts.data,
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
    if (!(e instanceof HttpError) || e.statusCode !== 401 || opts.skipAuth || opts._retry) {
      throw e;
    }

    if (isRefreshing) {
      const token = await new Promise<string | null>((resolveQ) => {
        refreshQueue.push(resolveQ);
      });
      if (!token) throw new HttpError('未授权', 401);
      return request<T>({ ...opts, _retry: true });
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      if (!newToken) throw new HttpError('未授权', 401);
      return request<T>({ ...opts, _retry: true });
    } finally {
      isRefreshing = false;
    }
  }
}
