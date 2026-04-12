<template>
  <div>
    <n-page-header title="审批中心" />

    <n-tabs v-model:value="tab" style="margin-top: 16px">
      <n-tab-pane name="pending" tab="待审批">
        <n-list v-if="pendingItems.length">
          <n-list-item v-for="item in pendingItems" :key="item.id">
            <n-thing :title="`部署 ${item.deploymentId.slice(0, 8)} → ${item.deployment?.environment?.name ?? '?'}`">
              <template #description>
                申请人：{{ item.requestedBy?.name }} ·
                {{ item.deployment?.branch }} ·
                {{ item.deployment?.commitMessage }}
              </template>
              <template #action>
                <n-space>
                  <n-button size="small" type="success" @click="review(item.id, 'approved')">
                    批准
                  </n-button>
                  <n-button size="small" type="error" @click="review(item.id, 'rejected')">
                    拒绝
                  </n-button>
                </n-space>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
        <div
          v-else
          style="margin-top: 16px; min-height: 45vh; display: flex; align-items: center; justify-content: center"
        >
          <n-empty description="暂无待审批" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="history" tab="已处理">
        <n-data-table :columns="histColumns" :data="histItems" size="small" :pagination="{ pageSize: 20 }" />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, watch } from 'vue';
import NaiveTagCell from '@/components/table/NaiveTagCell.vue';
import { useRoute } from 'vue-router';
import {
  NPageHeader, NTabs, NTabPane, NList, NListItem, NThing,
  NButton, NSpace, NEmpty, NDataTable, useMessage,
  type DataTableColumns,
} from 'naive-ui';
import {
  useOrgApprovalsActions,
  type ApprovalItem,
} from '@/composables/approvals/useOrgApprovalsActions';

const route = useRoute();
const message = useMessage();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const approvalsApi = useOrgApprovalsActions(orgSlug);
const tab = ref('pending');
const pendingItems = ref<ApprovalItem[]>([]);
const histItems = ref<ApprovalItem[]>([]);

const histColumns: DataTableColumns<ApprovalItem> = [
  { title: '部署', key: 'deploymentId', render: (r) => r.deploymentId.slice(0, 8) },
  { title: '环境', key: 'env', render: (r) => r.deployment?.environment?.name ?? '?' },
  {
    title: '状态', key: 'status', width: 100,
    render: (r) =>
      h(NaiveTagCell, {
        tagType: r.status === 'approved' ? 'success' : 'error',
        label: r.status,
      }),
  },
  { title: '审批人', key: 'reviewedBy', render: (r) => r.reviewedBy?.name ?? '—' },
];

async function review(id: string, decision: 'approved' | 'rejected') {
  await approvalsApi.reviewApproval(id, { decision });
  message.success(decision === 'approved' ? '已批准' : '已拒绝');
  await load();
}

async function load() {
  const all = await approvalsApi.listApprovals();
  pendingItems.value = all.filter((a) => a.status === 'pending');
  histItems.value = all.filter((a) => a.status !== 'pending');
}

watch(orgSlug, () => {
  void load();
}, { immediate: true });
</script>
