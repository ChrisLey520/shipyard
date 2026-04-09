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

    <n-grid :cols="2" :x-gap="16">
      <!-- 最近部署 -->
      <n-grid-item>
        <n-card title="最近部署">
          <n-data-table
            :columns="deployColumns"
            :data="recentDeployments"
            :loading="loading"
            size="small"
            :pagination="false"
          />
        </n-card>
      </n-grid-item>

      <!-- 构建次数图表 -->
      <n-grid-item>
        <n-card title="最近 7 天构建">
          <v-chart :option="chartOption" style="height: 240px" autoresize />
        </n-card>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  NPageHeader, NGrid, NGridItem, NStatistic, NCard,
  NDataTable, NTag, type DataTableColumns,
} from 'naive-ui';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { formatDuration } from '@shipyard/shared';
import { listProjectsForOrg, listDeploymentsForProject, type DashboardDeploymentLite } from './api';

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const route = useRoute();
const loading = ref(false);

const recentDeployments = ref<DashboardDeploymentLite[]>([]);
const stats = ref({ totalDeploys: 0, successRate: 0, avgDuration: '—', activeProjects: 0 });

const deployColumns: DataTableColumns<DashboardDeploymentLite> = [
  { title: '环境', key: 'environment', render: (row) => row.environment?.name ?? 'Preview' },
  { title: '分支', key: 'branch' },
  {
    title: '状态',
    key: 'status',
    render: (row) => h(NTag, { type: statusType(row.status), size: 'small' }, { default: () => row.status }),
  },
  {
    title: '耗时',
    key: 'durationMs',
    render: (row) => row.durationMs ? formatDuration(row.durationMs) : '—',
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
  xAxis: { type: 'category', data: getLast7Days() },
  yAxis: { type: 'value' },
  series: [{ data: Array(7).fill(0), type: 'bar', color: '#18a058' }],
}));

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
}

onMounted(async () => {
  const orgSlug = route.params['orgSlug'] as string;
  loading.value = true;
  try {
    const projects = await listProjectsForOrg(orgSlug);
    stats.value.activeProjects = projects.length;

    // 拉取各项目最近部署
    const allDeployments: DashboardDeploymentLite[] = [];
    for (const p of projects.slice(0, 3)) {
      const deps = (await listDeploymentsForProject(orgSlug, p.slug)).slice(0, 5);
      allDeployments.push(...deps);
    }
    recentDeployments.value = allDeployments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

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
});
</script>
