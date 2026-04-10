<template>
  <div>
    <n-page-header title="Dashboard" />

    <!-- 统计卡片 -->
    <n-grid :cols="4" :x-gap="16" style="margin: 16px 0">
      <n-grid-item>
        <n-statistic label="本月部署次数" :value="stats.totalDeploys" />
      </n-grid-item>
      <n-grid-item>
        <n-statistic label="成功率" :value="`${stats.successRate}%`" />
      </n-grid-item>
      <n-grid-item>
        <n-statistic label="平均构建时长" :value="stats.avgDuration" />
      </n-grid-item>
      <n-grid-item>
        <n-statistic label="活跃项目" :value="stats.activeProjects" />
      </n-grid-item>
    </n-grid>

    <n-grid :cols="2" :x-gap="16" class="dash-main-grid">
      <!-- 最近部署 -->
      <n-grid-item class="dash-main-grid-item">
        <n-card title="最近部署" class="dash-card">
          <div class="dash-card-body">
            <n-data-table
              :columns="deployColumns"
              :data="recentDeployments"
              :loading="loading"
              size="small"
              :pagination="false"
              :row-key="deploymentRowKey"
              :row-props="deploymentRowProps"
            />
          </div>
        </n-card>
      </n-grid-item>

      <!-- 构建次数图表 -->
      <n-grid-item class="dash-main-grid-item">
        <n-card title="最近 7 天构建" class="dash-card">
          <div class="dash-card-body">
            <v-chart :option="chartOption" class="dash-chart" autoresize />
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NGrid, NGridItem, NStatistic, NCard,
  NDataTable, NTag, type DataTableColumns,
} from 'naive-ui';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { formatDuration, deploymentStatusKey } from '@shipyard/shared';
import { useI18n } from 'vue-i18n';
import { listProjectsForOrg, listDeploymentsForProject, type DashboardDeploymentLite } from './api';

type DashboardDeploymentRow = DashboardDeploymentLite & { projectSlug: string };

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const route = useRoute();
const router = useRouter();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const loading = ref(false);
const { t } = useI18n();

const recentDeployments = ref<DashboardDeploymentRow[]>([]);
const stats = ref({ totalDeploys: 0, successRate: 0, avgDuration: '—', activeProjects: 0 });
const last7DaysLabels = ref<string[]>(getLast7Days());
const last7DaysBuildCounts = ref<number[]>(Array(7).fill(0));

function deploymentRowKey(row: DashboardDeploymentRow) {
  return row.id;
}

function deploymentRowProps(row: DashboardDeploymentRow) {
  return {
    style: { cursor: 'pointer' },
    onClick: () => {
      router.push(`/orgs/${orgSlug.value}/projects/${row.projectSlug}/deployments/${row.id}`);
    },
  };
}

const deployColumns: DataTableColumns<DashboardDeploymentRow> = [
  { title: '环境', key: 'environment', render: (row) => row.environment?.name ?? 'Preview' },
  { title: '分支', key: 'branch' },
  {
    title: '状态',
    key: 'status',
    render: (row) =>
      h(NTag, { type: statusType(row.status), size: 'small' }, { default: () => t(deploymentStatusKey(row.status)) }),
  },
  {
    title: '耗时',
    key: 'durationMs',
    render: (row) => (row.durationMs != null ? formatDuration(row.durationMs) : '—'),
  },
];

function statusType(status: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
  const map: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
    success: 'success',
    failed: 'error',
    building: 'warning',
    deploying: 'info',
    queued: 'default',
    pending_approval: 'warning',
  };
  return map[status] ?? 'default';
}

const chartOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: last7DaysLabels.value },
  yAxis: { type: 'value' },
  series: [{ data: last7DaysBuildCounts.value, type: 'bar', color: '#18a058' }],
}));

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
}

function calcLast7DaysBuildCounts(deployments: DashboardDeploymentRow[]) {
  // bucket by local day (year-month-day) for last 7 days
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
  const counts = Array(7).fill(0) as number[];

  for (const dep of deployments) {
    const t = new Date(dep.createdAt);
    if (Number.isNaN(t.getTime())) continue;
    if (t < start) continue;
    const k = dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
    const i = index.get(k);
    if (i != null) counts[i] = (counts[i] ?? 0) + 1;
  }
  last7DaysLabels.value = getLast7Days();
  last7DaysBuildCounts.value = counts;
}

async function loadDashboard() {
  loading.value = true;
  try {
    const slug = orgSlug.value;
    const projects = await listProjectsForOrg(slug);
    stats.value.activeProjects = projects.length;

    // Pull enough history for the 7-day chart (cap projects for perf)
    const projectsForFetch = projects.slice(0, 10);
    const deploymentsByProject = await Promise.all(
      projectsForFetch.map(async (p) => ({
        projectSlug: p.slug,
        deployments: await listDeploymentsForProject(slug, p.slug),
      })),
    );

    const allDeployments: DashboardDeploymentRow[] = [];
    for (const item of deploymentsByProject) {
      for (const d of item.deployments) {
        allDeployments.push({ ...d, projectSlug: item.projectSlug });
      }
    }

    // Recent table: show only a few most recent items
    recentDeployments.value = allDeployments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    calcLast7DaysBuildCounts(allDeployments);

    const successes = allDeployments.filter((d) => d.status === 'success');
    stats.value.totalDeploys = allDeployments.length;
    stats.value.successRate = allDeployments.length
      ? Math.round((successes.length / allDeployments.length) * 100)
      : 100;
    const avgMs = successes.reduce((s, d) => s + (d.durationMs ?? 0), 0) / (successes.length || 1);
    stats.value.avgDuration = successes.length ? formatDuration(avgMs) : '—';
  } finally {
    loading.value = false;
  }
}

watch(orgSlug, () => {
  void loadDashboard();
}, { immediate: true });
</script>

<style scoped>
.dash-main-grid {
  align-items: stretch;
}

.dash-main-grid-item {
  display: flex;
}

.dash-card {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dash-card-body {
  flex: 1;
  min-height: 260px;
}

.dash-chart {
  height: 260px;
}
</style>
