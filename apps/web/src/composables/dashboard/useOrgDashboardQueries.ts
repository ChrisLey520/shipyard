import { useQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { formatDuration } from '@shipyard/shared';
import {
  listDeploymentsForProject,
  listProjectsForOrg,
  type DashboardDeploymentLite,
} from '@/api/dashboard';

/** 与 Dashboard 表格行一致：多项目合并后附带 projectSlug */
export type DashboardDeploymentRow = DashboardDeploymentLite & { projectSlug: string };

export interface OrgDashboardModel {
  recentDeployments: DashboardDeploymentRow[];
  stats: {
    totalDeploys: number;
    successRate: number;
    avgDuration: string;
    activeProjects: number;
  };
  last7DaysLabels: string[];
  last7DaysBuildCounts: number[];
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
}

function buildDashboardModel(allDeployments: DashboardDeploymentRow[]): OrgDashboardModel {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const keys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return dayKey(d);
  });
  const index = new Map(keys.map((k, i) => [k, i]));
  const counts = Array<number>(7).fill(0);

  for (const dep of allDeployments) {
    const t = new Date(dep.createdAt);
    if (Number.isNaN(t.getTime())) continue;
    if (t < start) continue;
    const k = dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
    const i = index.get(k);
    if (i != null) counts[i] = (counts[i] ?? 0) + 1;
  }

  const recentDeployments = [...allDeployments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const successes = allDeployments.filter((d) => d.status === 'success');
  const totalDeploys = allDeployments.length;
  const successRate = totalDeploys ? Math.round((successes.length / totalDeploys) * 100) : 100;
  const avgMs = successes.reduce((s, d) => s + (d.durationMs ?? 0), 0) / (successes.length || 1);
  const avgDuration = successes.length ? formatDuration(avgMs) : '—';

  return {
    recentDeployments,
    stats: {
      totalDeploys,
      successRate,
      avgDuration,
      activeProjects: 0,
    },
    last7DaysLabels: getLast7Days(),
    last7DaysBuildCounts: counts,
  };
}

async function fetchOrgDashboard(orgSlug: string): Promise<OrgDashboardModel> {
  const projects = await listProjectsForOrg(orgSlug);
  const projectsForFetch = projects.slice(0, 10);
  const deploymentsByProject = await Promise.all(
    projectsForFetch.map(async (p) => ({
      projectSlug: p.slug,
      deployments: await listDeploymentsForProject(orgSlug, p.slug),
    })),
  );

  const allDeployments: DashboardDeploymentRow[] = [];
  for (const item of deploymentsByProject) {
    for (const d of item.deployments) {
      allDeployments.push({ ...d, projectSlug: item.projectSlug });
    }
  }

  const model = buildDashboardModel(allDeployments);
  model.stats.activeProjects = projects.length;
  return model;
}

/** 组织 Dashboard：项目列表 + 多项目部署聚合，稳定 queryKey 便于失效刷新 */
export function useOrgDashboardQueries(orgSlug: MaybeRefOrGetter<string>) {
  const slug = computed(() => toValue(orgSlug));

  return useQuery({
    queryKey: computed(() => ['dashboard', 'org', slug.value] as const),
    queryFn: () => fetchOrgDashboard(slug.value),
    enabled: computed(() => Boolean(slug.value)),
  });
}
