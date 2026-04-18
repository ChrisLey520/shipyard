<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDataTable,
  NFormItem,
  NInput,
  NLayout,
  NLayoutContent,
  NPageHeader,
  NSpace,
  useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchEventList, fetchHourlyMetrics } from '../api';

const router = useRouter();
const message = useMessage();

const loading = ref(false);
const chartLoading = ref(false);
const items = ref<
  Array<{
    id: string;
    eventId: string;
    receivedAt: string;
    type: string;
    platform: string;
    release: string | null;
    route: string | null;
    message: string | null;
    projectKey: string;
  }>
>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filters = ref({
  projectKey: '',
  platform: '',
  release: '',
  route: '',
  type: 'error',
});

/** 按日聚合（由小时桶汇总） */
const dailyBars = ref<Array<{ day: string; count: number }>>([]);

const columns = computed<DataTableColumns<(typeof items.value)[number]>>(() => [
  { title: 'receivedAt', key: 'receivedAt', width: 200, ellipsis: { tooltip: true } },
  { title: 'type', key: 'type', width: 120 },
  { title: 'platform', key: 'platform', width: 140 },
  { title: 'project', key: 'projectKey', width: 120 },
  { title: 'release', key: 'release', ellipsis: { tooltip: true } },
  { title: 'route', key: 'route', ellipsis: { tooltip: true } },
  { title: 'message', key: 'message', ellipsis: { tooltip: true } },
]);

const maxDayCount = computed(() => Math.max(1, ...dailyBars.value.map((d) => d.count)));

async function loadChart(): Promise<void> {
  const pk = filters.value.projectKey.trim();
  if (!pk) {
    dailyBars.value = [];
    return;
  }
  chartLoading.value = true;
  try {
    const { buckets } = await fetchHourlyMetrics({
      projectKey: pk,
      days: 14,
      ...(filters.value.type ? { type: filters.value.type } : {}),
      ...(filters.value.release ? { release: filters.value.release } : {}),
    });
    const byDay = new Map<string, number>();
    for (const b of buckets) {
      const day = b.bucketStart.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + b.count);
    }
    dailyBars.value = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
    dailyBars.value = [];
  } finally {
    chartLoading.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const q = new URLSearchParams();
    q.set('page', String(page.value));
    q.set('pageSize', String(pageSize.value));
    if (filters.value.projectKey) q.set('projectKey', filters.value.projectKey);
    if (filters.value.platform) q.set('platform', filters.value.platform);
    if (filters.value.release) q.set('release', filters.value.release);
    if (filters.value.route) q.set('route', filters.value.route);
    if (filters.value.type) q.set('type', filters.value.type);
    const res = await fetchEventList(q);
    items.value = res.items;
    total.value = res.total;
    await loadChart();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());

watch([page, pageSize], () => void load());

function rowProps(row: (typeof items.value)[number]) {
  return {
    style: 'cursor:pointer',
    onClick: () => router.push(`/events/${row.id}`),
  };
}
</script>

<template>
  <n-layout>
    <n-layout-content style="padding: 24px; max-width: 1400px; margin: 0 auto">
      <n-page-header title="监控事件" subtitle="v2：趋势 / 符号化 / 告警见各页">
        <template #extra>
          <n-button quaternary @click="() => void router.push('/settings')">项目与告警</n-button>
        </template>
      </n-page-header>
      <n-card style="margin-top: 16px" title="筛选">
        <n-space vertical>
          <n-space>
            <n-form-item label="projectKey" label-placement="left">
              <n-input v-model:value="filters.projectKey" clearable style="width: 160px" />
            </n-form-item>
            <n-form-item label="platform" label-placement="left">
              <n-input v-model:value="filters.platform" clearable style="width: 140px" />
            </n-form-item>
            <n-form-item label="release" label-placement="left">
              <n-input v-model:value="filters.release" clearable style="width: 140px" />
            </n-form-item>
            <n-form-item label="route" label-placement="left">
              <n-input v-model:value="filters.route" clearable style="width: 180px" />
            </n-form-item>
            <n-form-item label="type" label-placement="left">
              <n-input v-model:value="filters.type" clearable style="width: 120px" />
            </n-form-item>
            <n-button type="primary" @click="() => { page = 1; void load(); }">查询</n-button>
          </n-space>
          <p v-if="!filters.projectKey.trim()" style="color: var(--n-text-color-3); margin: 0">
            填写 projectKey 后可显示近 14 日按日汇总趋势（来自小时预聚合桶）。
          </p>
        </n-space>
      </n-card>
      <n-card v-if="filters.projectKey.trim()" style="margin-top: 16px" title="趋势（按日事件量）">
        <p v-if="chartLoading">加载趋势…</p>
        <div v-else-if="dailyBars.length === 0" style="color: var(--n-text-color-3)">暂无聚合数据（需有新事件写入后才会出现桶）</div>
        <div v-else style="display: flex; align-items: flex-end; gap: 6px; height: 160px; padding-top: 8px">
          <div
            v-for="bar in dailyBars"
            :key="bar.day"
            :title="`${bar.day}: ${bar.count}`"
            style="flex: 1; min-width: 8px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center"
          >
            <div
              :style="{
                width: '100%',
                maxWidth: '24px',
                height: `${(bar.count / maxDayCount) * 120}px`,
                minHeight: bar.count > 0 ? '4px' : '0',
                background: 'var(--n-color-target)',
                borderRadius: '4px 4px 0 0',
              }"
            />
            <span style="font-size: 10px; margin-top: 4px; writing-mode: horizontal-tb; transform: rotate(-45deg); transform-origin: center">
              {{ bar.day.slice(5) }}
            </span>
          </div>
        </div>
      </n-card>
      <n-card style="margin-top: 16px" title="列表">
        <n-data-table
          :columns="columns"
          :data="items"
          :loading="loading"
          :bordered="true"
          :single-line="false"
          :row-props="rowProps"
          :pagination="{
            page: page,
            pageSize: pageSize,
            itemCount: total,
            onUpdatePage: (p) => { page = p; },
            onUpdatePageSize: (s) => { pageSize = s; page = 1; },
          }"
        />
      </n-card>
    </n-layout-content>
  </n-layout>
</template>
