import { createDiscreteApi } from 'naive-ui';
import {
  formatApiErrorMessage,
  isShipyardAuthPublicApiPath,
  parseShipyardApiErrorBody,
  resolveApiErrorDisplay,
  type ApiErrorDisplay,
  type ShipyardApiErrorBody,
} from '@shipyard/shared';
import type { AxiosError, AxiosRequestConfig } from 'axios';

export type ShipyardAxiosMeta = {
  /** 不展示全局 message/modal，由页面自行处理 */
  silent?: boolean;
  /** 覆盖服务端 errorDisplay 与默认推断 */
  errorDisplay?: ApiErrorDisplay;
  /** 为 true 时 401 不进入 refresh（登录等公开接口） */
  skipAuthRefresh?: boolean;
};

let messageApi: ReturnType<typeof createDiscreteApi>['message'] | null = null;
let dialogApi: ReturnType<typeof createDiscreteApi>['dialog'] | null = null;

function ensureDiscrete() {
  if (!messageApi || !dialogApi) {
    const { message, dialog } = createDiscreteApi(['message', 'dialog']);
    messageApi = message;
    dialogApi = dialog;
  }
}

export function loginRedirectUrl(): string {
  const path = `${window.location.pathname}${window.location.search || ''}`;
  const q = path ? `?redirect=${encodeURIComponent(path)}` : '';
  return `/login${q}`;
}

/** 会话失效：整页跳转登录并带回跳（避免与 axios meta.silent 冲突） */
export function applyShipyardSessionExpiredRedirect(): void {
  window.location.assign(loginRedirectUrl());
}

/**
 * 根据接口契约与 HTTP 状态展示全局错误（message / modal / silent / redirect）
 */
export function applyShipyardAxiosError(
  error: AxiosError<unknown>,
  extra?: { preferLoginRedirect?: boolean },
): void {
  const cfg = error.config as (AxiosRequestConfig & { shipyard?: ShipyardAxiosMeta }) | undefined;
  if (cfg?.shipyard?.silent) return;

  const status = error.response?.status ?? 0;
  const raw = error.response?.data;
  const body: ShipyardApiErrorBody | null = parseShipyardApiErrorBody(raw);
  const url = cfg?.url ?? '';
  const authPublic401 = isShipyardAuthPublicApiPath(url) && status === 401;

  const mode = resolveApiErrorDisplay(status, body, {
    silent: cfg?.shipyard?.silent,
    errorDisplay: cfg?.shipyard?.errorDisplay,
    authPublic401,
  });

  const text = formatApiErrorMessage(body, error.message || '网络异常');

  if (mode === 'silent') return;

  ensureDiscrete();

  if (mode === 'redirect') {
    const path = body?.redirectPath?.startsWith('/') ? body.redirectPath : loginRedirectUrl();
    window.location.assign(path);
    return;
  }

  if (extra?.preferLoginRedirect) {
    applyShipyardSessionExpiredRedirect();
    return;
  }

  if (mode === 'modal') {
    dialogApi!.error({
      title: '请求失败',
      content: text,
      positiveText: '知道了',
    });
    return;
  }

  messageApi!.error(text, { duration: 4500, closable: true });
}

export function applyShipyardNetworkError(fallbackMessage = '网络不可用，请检查连接后重试'): void {
  ensureDiscrete();
  messageApi!.error(fallbackMessage, { duration: 4500, closable: true });
}
