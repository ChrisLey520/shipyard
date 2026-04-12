/** 解析登录页 `redirect` query：仅允许主包 / 组织分包路径，防 open redirect */

/**
 * 延后执行导航。冷启动阶段在 onShow 等生命周期里同步 reLaunch 时，部分基础库会报 WAServiceMainContext Error: timeout。
 */
export function deferMiniProgramNavigation(fn: () => void, delayMs = 0): void {
  setTimeout(fn, delayMs);
}

export function resolveLoginRedirect(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const decoded = decodeURIComponent(raw.trim());
    if (!decoded.startsWith('/') || decoded.includes('..')) return null;
    if (!decoded.startsWith('/pages/') && !decoded.startsWith('/package-org/')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function reLaunchAfterAuth(redirectFromQuery?: string) {
  deferMiniProgramNavigation(() => {
    const t = resolveLoginRedirect(redirectFromQuery);
    const url = t ?? '/pages/workspace/dashboard';
    uni.reLaunch({
      url,
      fail: (err) => {
        const msg = err.errMsg ?? '';
        uni.showToast({
          title: /timeout/i.test(msg) ? '跳转超时，请再试一次' : '页面跳转失败，请重试',
          icon: 'none',
          duration: 3500,
        });
      },
    });
  });
}

/** 构建当前页完整路径（含 query），用于登录后回跳 */

export function buildCurrentPageRedirectUrl(): string {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1] as {
    route?: string;
    options?: Record<string, string | undefined>;
  };
  if (!cur?.route) return '';
  // 各端 route 多为 pages/... 或 package-org/...，统一为以 / 开头的 reLaunch 路径
  const path = cur.route.startsWith('/') ? cur.route : `/${cur.route}`;
  const o = cur.options ?? {};
  const parts = Object.keys(o).map((k) => {
    const v = o[k];
    return `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`;
  });
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

/** 未登录时跳转登录并携带回跳路径（对齐 Web redirect query 语义） */
export function reLaunchToLoginWithRedirect(): void {
  deferMiniProgramNavigation(() => {
    const pages = getCurrentPages();
    const last = pages[pages.length - 1] as { route?: string } | undefined;
    const route = last?.route ?? '';
    if (route === 'pages/auth/login' || route.endsWith('/auth/login')) return;

    const r = buildCurrentPageRedirectUrl();
    const suffix = r ? `?redirect=${encodeURIComponent(r)}` : '';
    uni.reLaunch({ url: `/pages/auth/login${suffix}` });
  });
}
