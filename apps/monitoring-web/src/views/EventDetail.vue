<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NAlert,
  NButton,
  NCard,
  NCode,
  NDataTable,
  NLayout,
  NLayoutContent,
  NPageHeader,
  NSpace,
  useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchEventDetail } from '../api';

const props = defineProps<{ id: string }>();
const router = useRouter();
const message = useMessage();
const loading = ref(true);
const detail = ref<{
  id: string;
  eventId: string;
  receivedAt: string;
  projectKey: string;
  event: unknown;
  symbolicatedStack?: { lines: string[]; notice: string | null } | null;
  breadcrumbs?: unknown;
} | null>(null);

onMounted(async () => {
  try {
    detail.value = await fetchEventDetail(props.id);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
});

const jsonText = () => JSON.stringify(detail.value?.event ?? {}, null, 2);

type Crumb = { t?: string; category?: string; message?: string; data?: unknown };
const crumbRows = (): Crumb[] => {
  const b = detail.value?.breadcrumbs;
  if (!Array.isArray(b)) return [];
  return b.filter((x): x is Crumb => x && typeof x === 'object');
};

const crumbColumns: DataTableColumns<Crumb> = [
  { title: 'time', key: 't', width: 180 },
  { title: 'category', key: 'category', width: 120 },
  { title: 'message', key: 'message', ellipsis: { tooltip: true } },
];
</script>

<template>
  <n-layout>
    <n-layout-content style="padding: 24px; max-width: 960px; margin: 0 auto">
      <n-page-header title="事件详情" @back="() => void router.push('/')">
        <template #extra>
          <n-space>
            <n-button quaternary @click="() => void router.push('/')">返回列表</n-button>
          </n-space>
        </template>
      </n-page-header>
      <n-card v-if="detail" style="margin-top: 16px" title="元数据">
        <p>id: {{ detail.id }}</p>
        <p>eventId: {{ detail.eventId }}</p>
        <p>receivedAt: {{ detail.receivedAt }}</p>
        <p>projectKey: {{ detail.projectKey }}</p>
      </n-card>
      <n-card v-if="detail?.symbolicatedStack?.notice" style="margin-top: 16px" title="堆栈说明">
        <n-alert type="warning" :title="detail.symbolicatedStack.notice" />
      </n-card>
      <n-card v-if="detail?.symbolicatedStack?.lines?.length" style="margin-top: 16px" title="堆栈（符号化 / 原始）">
        <n-code
          language="text"
          :code="detail.symbolicatedStack.lines.join('\n')"
          word-wrap
          style="max-height: 40vh; overflow: auto"
        />
      </n-card>
      <n-card v-if="crumbRows().length" style="margin-top: 16px" title="面包屑">
        <n-data-table :columns="crumbColumns" :data="crumbRows()" :bordered="true" size="small" />
      </n-card>
      <n-card style="margin-top: 16px" title="完整事件 JSON">
        <n-code v-if="!loading" language="json" :code="jsonText()" word-wrap style="max-height: 50vh; overflow: auto" />
        <p v-else>加载中…</p>
      </n-card>
    </n-layout-content>
  </n-layout>
</template>
