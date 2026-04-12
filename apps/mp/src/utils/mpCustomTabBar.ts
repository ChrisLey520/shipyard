/** 主包 Tab 页底栏：与 pages.json tabBar.list 的 pagePath 一致；图标须以 / 开头，否则在组件内会按 /components 相对解析 */

export type MpCustomTabItem = {
  route: string;
  switchPath: string;
  icon: string;
  iconOn: string;
  i18nKey: string;
};

export const MP_CUSTOM_TAB_ITEMS: MpCustomTabItem[] = [
  {
    route: 'pages/workspace/dashboard',
    switchPath: '/pages/workspace/dashboard',
    icon: '/static/tabbar/work.png',
    iconOn: '/static/tabbar/work-active.png',
    i18nKey: 'tab.work',
  },
  {
    route: 'pages/deployment/index',
    switchPath: '/pages/deployment/index',
    icon: '/static/tabbar/deploy.png',
    iconOn: '/static/tabbar/deploy-active.png',
    i18nKey: 'tab.deploy',
  },
  {
    route: 'pages/collaboration/index',
    switchPath: '/pages/collaboration/index',
    icon: '/static/tabbar/collab.png',
    iconOn: '/static/tabbar/collab-active.png',
    i18nKey: 'tab.collab',
  },
  {
    route: 'pages/orgs/list',
    switchPath: '/pages/orgs/list',
    icon: '/static/tabbar/org.png',
    iconOn: '/static/tabbar/org-active.png',
    i18nKey: 'tab.org',
  },
  {
    route: 'pages/settings/personal',
    switchPath: '/pages/settings/personal',
    icon: '/static/tabbar/me.png',
    iconOn: '/static/tabbar/me-active.png',
    i18nKey: 'tab.me',
  },
];
