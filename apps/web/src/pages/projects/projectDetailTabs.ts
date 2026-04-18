/**
 * 项目详情子路由路径段，对应 `/orgs/:orgSlug/projects/:projectSlug/:tab`
 * 顺序与详情页 Tab 展示顺序一致。
 */
export const PROJECT_DETAIL_TAB_SEGMENTS = [
  'overview',
  'environments',
  'notifications',
  'feature-flags',
  'deployments',
  'settings',
] as const;

export type ProjectDetailTab = (typeof PROJECT_DETAIL_TAB_SEGMENTS)[number];

export const DEFAULT_PROJECT_DETAIL_TAB: ProjectDetailTab = 'overview';

export function isProjectDetailTab(s: string): s is ProjectDetailTab {
  return (PROJECT_DETAIL_TAB_SEGMENTS as readonly string[]).includes(s);
}

export function projectDetailTabPath(orgSlug: string, projectSlug: string, tab: ProjectDetailTab): string {
  return `/orgs/${orgSlug}/projects/${projectSlug}/${tab}`;
}
