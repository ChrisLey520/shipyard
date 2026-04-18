/**
 * 与 pages.json 中 navigationBarTitleText 一致，供 page-meta 内 navigation-bar 使用。
 * 微信要求 page-meta 下声明 navigation-bar 时须带标题，否则表现不稳定。
 */
const ROUTE_TO_TITLE: Record<string, string> = {
  'pages/auth/login': '登录',
  'pages/auth/register': '注册',
  'pages/auth/forgot': '忘记密码',
  'pages/auth/reset': '重置密码',
  'pages/workspace/dashboard': '首页',
  'pages/orgs/list': '组织',
  'pages/settings/personal': '个人设置',
  'pages/deployment/index': '部署',
  'package-org/pages/projects/new': '新建项目',
  'package-org/pages/projects/detail': '项目详情',
  'package-org/pages/projects/deployment-detail': '部署',
  'package-org/pages/servers/index': '服务器',
  'pages/collaboration/index': '协作',
  'package-org/pages/approvals/index': '审批',
  'package-org/pages/git-accounts/index': 'Git 账户',
  'package-org/pages/settings/org': '组织设置',
};

export function getMpPageNavTitle(): string {
  try {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1] as { route?: string } | undefined;
    const route = cur?.route ?? '';
    return ROUTE_TO_TITLE[route] ?? 'Shipyard';
  } catch {
    return 'Shipyard';
  }
}
