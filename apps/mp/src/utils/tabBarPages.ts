/**
 * 与 pages.json tabBar.list 的 pagePath 一致（H5 等原生 TabBar 端用于 setTabBarStyle 守卫）
 */
const TAB_BAR_PAGE_ROUTES = new Set([
  'pages/workspace/dashboard',
  'pages/deployment/index',
  'pages/collaboration/index',
  'pages/orgs/list',
  'pages/settings/personal',
]);

/** 当前栈顶是否为 TabBar 页（非 Tab 页调用 setTabBarStyle 会报错并触发 MiniProgramError） */
export function isCurrentPageTabBar(): boolean {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1] as { route?: string } | undefined;
  const route = (cur?.route ?? '').replace(/^\//, '');
  return TAB_BAR_PAGE_ROUTES.has(route);
}
