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
import { computed, h } from 'vue';
import NaiveTagCell from '@/components/table/NaiveTagCell.vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NGrid, NGridItem, NStatistic, NCard,
  NDataTable, type DataTableColumns,
} from 'naive-ui';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { formatDuration, deploymentStatusKey } from '@shipyard/shared';
import { useI18n } from 'vue-i18n';
import {
  useOrgDashboardQueries,
  type DashboardDeploymentRow,
} from '@/composables/dashboard/useOrgDashboardQueries';

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const route = useRoute();
const router = useRouter();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const { t } = useI18n();

const dashboardQuery = useOrgDashboardQueries(orgSlug);
const loading = computed(() => dashboardQuery.isPending.value || dashboardQuery.isFetching.value);
const recentDeployments = computed<DashboardDeploymentRow[]>(
  () => dashboardQuery.data.value?.recentDeployments ?? [],
);
const stats = computed(() =>
  dashboardQuery.data.value?.stats ?? {
    totalDeploys: 0,
    successRate: 0,
    avgDuration: '—',
    activeProjects: 0,
  },
);
const last7DaysLabels = computed(() => dashboardQuery.data.value?.last7DaysLabels ?? []);
const last7DaysBuildCounts = computed(() => dashboardQuery.data.value?.last7DaysBuildCounts ?? Array(7).fill(0));

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
      h(NaiveTagCell, {
        tagType: statusType(row.status),
        label: t(deploymentStatusKey(row.status)),
      }),
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
