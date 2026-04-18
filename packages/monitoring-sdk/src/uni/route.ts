/** 由 uni-app / 小程序运行时注入 */
declare function getCurrentPages(): Array<{ route?: string; options?: Record<string, string> }>;

export function getCurrentUniRoute(): string | undefined {
  try {
    if (typeof getCurrentPages !== 'function') return undefined;
    const pages = getCurrentPages();
    const p = pages[pages.length - 1];
    if (!p?.route) return undefined;
    return `/${p.route}`;
  } catch {
    return undefined;
  }
}
