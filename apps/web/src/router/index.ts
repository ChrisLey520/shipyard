import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  // 认证页（无需 Layout）
  { path: '/login', component: () => import('../pages/auth/LoginPage.vue') },
  { path: '/register', component: () => import('../pages/auth/RegisterPage.vue') },
  { path: '/forgot-password', component: () => import('../pages/auth/ForgotPasswordPage.vue') },
  { path: '/reset-password', component: () => import('../pages/auth/ResetPasswordPage.vue') },

  // 个人设置（有 Layout，但不属于某个组织）
  {
    path: '/settings',
    component: () => import('../components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [{ path: '', component: () => import('../pages/settings/PersonalSettingsPage.vue') }],
  },

  // 组织选择页（有 Layout）
  {
    path: '/orgs',
    component: () => import('../components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('../pages/orgs/OrgListPage.vue') },
    ],
  },

  // 组织内页面
  {
    path: '/orgs/:orgSlug',
    component: () => import('../components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('../pages/dashboard/DashboardPage.vue') },

      // 项目
      { path: 'projects', component: () => import('../pages/projects/ProjectListPage.vue') },
      { path: 'projects/new', component: () => import('../pages/projects/ProjectNewPage.vue') },
      {
        path: 'projects/:projectSlug/settings',
        component: () => import('../pages/projects/ProjectSettingsPage.vue'),
      },
      { path: 'projects/:projectSlug', component: () => import('../pages/projects/ProjectDetailPage.vue') },
      {
        path: 'projects/:projectSlug/environments',
        redirect: (to) => ({
          path: `/orgs/${String(to.params['orgSlug'])}/projects/${String(to.params['projectSlug'])}`,
          query: { tab: 'environments' },
        }),
      },
      {
        path: 'projects/:projectSlug/deployments/:deploymentId',
        component: () => import('../pages/pipeline/DeploymentDetailPage.vue'),
      },

      // 服务器
      { path: 'servers', component: () => import('../pages/servers/ServersPage.vue') },

      // 团队
      { path: 'team', component: () => import('../pages/team/TeamPage.vue') },

      // 审批
      { path: 'approvals', component: () => import('../pages/approvals/ApprovalsPage.vue') },

      // Git 账户
      { path: 'git-accounts', component: () => import('../pages/git-accounts/GitAccountsPage.vue') },

      // 组织设置
      { path: 'settings', component: () => import('../pages/settings/OrgSettingsPage.vue') },
    ],
  },

  // 根路径重定向
  { path: '/', redirect: '/orgs' },
  { path: '/:pathMatch(.*)*', redirect: '/orgs' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta['requiresAuth']) {
    if (!auth.accessToken) {
      return { path: '/login', query: { redirect: to.fullPath } };
    }
    // 首次加载时填充用户信息
    if (!auth.user) {
      try {
        await auth.fetchMe();
      } catch {
        return { path: '/login', query: { redirect: to.fullPath } };
      }
    }
  }
});

export default router;
