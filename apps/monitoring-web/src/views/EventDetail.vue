<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NCode, NLayout, NLayoutContent, NPageHeader, NSpace, useMessage } from 'naive-ui';
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
      <n-card style="margin-top: 16px" title="完整事件（含 breadcrumbs / payload）">
        <n-code v-if="!loading" language="json" :code="jsonText()" word-wrap style="max-height: 70vh; overflow: auto" />
        <p v-else>加载中…</p>
      </n-card>
    </n-layout-content>
  </n-layout>
</template>
