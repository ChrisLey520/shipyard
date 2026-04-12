<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NDataTable, NFormItem, NInput, NLayout, NLayoutContent, NPageHeader, NSpace, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchEventList } from '../api';

const router = useRouter();
const message = useMessage();

const loading = ref(false);
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
  type: '',
});

const columns = computed<DataTableColumns<(typeof items.value)[number]>>(() => [
  { title: 'receivedAt', key: 'receivedAt', width: 200, ellipsis: { tooltip: true } },
  { title: 'type', key: 'type', width: 120 },
  { title: 'platform', key: 'platform', width: 140 },
  { title: 'project', key: 'projectKey', width: 120 },
  { title: 'release', key: 'release', ellipsis: { tooltip: true } },
  { title: 'route', key: 'route', ellipsis: { tooltip: true } },
  { title: 'message', key: 'message', ellipsis: { tooltip: true } },
]);

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
      <n-page-header title="监控事件" subtitle="独立管理台 MVP" />
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
        </n-space>
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
