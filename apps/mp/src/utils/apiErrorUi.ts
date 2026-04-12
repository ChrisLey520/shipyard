import {
  formatApiErrorMessage,
  isShipyardAuthPublicApiPath,
  parseShipyardApiErrorBody,
  resolveApiErrorDisplay,
  type ApiErrorDisplay,
  type ShipyardApiErrorBody,
} from '@shipyard/shared';
import { deferMiniProgramNavigation, reLaunchToLoginWithRedirect } from '@/utils/redirectLogin';

export type MpHttpErrorLike = {
  message: string;
  statusCode?: number;
  body?: unknown;
  skipGlobalUi?: boolean;
};

export type MpRequestShipyardMeta = {
  silent?: boolean;
  errorDisplay?: ApiErrorDisplay;
  skipAuthRefresh?: boolean;
};

export function applyMpHttpErrorUi(
  err: MpHttpErrorLike,
  opts?: { url?: string; shipyard?: MpRequestShipyardMeta; preferLoginRedirect?: boolean },
): void {
  if (err.skipGlobalUi) return;
  if (opts?.shipyard?.silent) return;

  const status = err.statusCode ?? 0;
  const body: ShipyardApiErrorBody | null = parseShipyardApiErrorBody(err.body);
  const url = opts?.url ?? '';
  const authPublic401 = isShipyardAuthPublicApiPath(url) && status === 401;

  const mode = resolveApiErrorDisplay(status, body, {
    silent: opts?.shipyard?.silent,
    errorDisplay: opts?.shipyard?.errorDisplay,
    authPublic401,
  });

  const text = formatApiErrorMessage(body, err.message || '请求失败');

  if (mode === 'silent') return;

  if (mode === 'redirect' || opts?.preferLoginRedirect) {
    if (body?.redirectPath?.startsWith('/')) {
      deferMiniProgramNavigation(() => uni.reLaunch({ url: body.redirectPath! }));
    } else {
      reLaunchToLoginWithRedirect();
    }
    return;
  }

  if (mode === 'modal') {
    uni.showModal({
      title: '请求失败',
      content: text,
      showCancel: false,
    });
    return;
  }

  uni.showToast({ title: text.length > 20 ? `${text.slice(0, 20)}…` : text, icon: 'none', duration: 3500 });
}

export function applyMpNetworkErrorUi(message = '网络异常，请稍后重试'): void {
  uni.showToast({ title: message, icon: 'none', duration: 3500 });
}
