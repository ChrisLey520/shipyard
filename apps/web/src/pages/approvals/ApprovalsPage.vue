<template>
  <div class="min-w-0 page-header-stack-sm">
    <n-page-header :title="t('approvalsPage.title')" />

    <n-spin :show="loading">
      <n-tabs v-model:value="tab" class="mt-4">
        <n-tab-pane name="pending" :tab="t('approvalsPage.tabPending')">
          <div v-if="pendingItems.length" class="mt-4 flex flex-col gap-3">
            <n-card v-for="item in pendingItems" :key="item.id" size="small" class="approval-pending-card">
              <div class="text-[15px] font-600 leading-snug">
                {{ deploymentTitle(item) }}
              </div>
              <div class="mt-2 text-sm leading-snug break-words text-[var(--n-text-color-3)]">
                {{ applicantLine(item) }}
              </div>
              <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <n-button
                  class="w-full sm:w-auto"
                  size="small"
                  type="error"
                  @click="review(item.id, 'rejected')"
                >
                  {{ t('approvalsPage.reject') }}
                </n-button>
                <n-button
                  class="w-full sm:w-auto"
                  size="small"
                  type="success"
                  @click="review(item.id, 'approved')"
                >
                  {{ t('approvalsPage.approve') }}
                </n-button>
              </div>
            </n-card>
          </div>
          <div
            v-else
            class="mt-4 flex min-h-[45vh] items-center justify-center"
          >
            <n-empty :description="t('approvalsPage.emptyPending')" />
          </div>
        </n-tab-pane>

        <n-tab-pane name="history" :tab="t('approvalsPage.tabHistory')">
          <n-data-table
            class="mt-4"
            :columns="histColumns"
            :data="histItems"
            size="small"
            :scroll-x="880"
            :pagination="{ pageSize: 20 }"
          />
        </n-tab-pane>
      </n-tabs>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import NaiveTagCell from '@/components/table/NaiveTagCell.vue';
import { useRoute } from 'vue-router';
import {
  NPageHeader, NTabs, NTabPane, NCard, NButton, NEmpty, NDataTable, NSpin, useMessage,
  type DataTableColumns,
} from 'naive-ui';
import {
  useOrgApprovalsActions,
  type ApprovalItem,
} from '@/composables/approvals/useOrgApprovalsActions';

const route = useRoute();
const message = useMessage();
const { t } = useI18n();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const approvalsApi = useOrgApprovalsActions(orgSlug);
const tab = ref('pending');
const pendingItems = ref<ApprovalItem[]>([]);
const histItems = ref<ApprovalItem[]>([]);
const loading = ref(false);

const histColumns = computed<DataTableColumns<ApprovalItem>>(() => [
  { title: t('approvalsPage.colDeployment'), key: 'deploymentId', render: (r) => r.deploymentId.slice(0, 8) },
  { title: t('approvalsPage.colEnv'), key: 'env', render: (r) => r.deployment?.environment?.name ?? '?' },
  {
    title: t('approvalsPage.colStatus'),
    key: 'status',
    width: 100,
    render: (r) =>
      h(NaiveTagCell, {
        tagType: r.status === 'approved' ? 'success' : 'error',
        label:
          r.status === 'approved'
            ? t('approvalsPage.statusApproved')
            : t('approvalsPage.statusRejected'),
      }),
  },
  { title: t('approvalsPage.colReviewer'), key: 'reviewedBy', render: (r) => r.reviewedBy?.name ?? '—' },
]);

function deploymentTitle(item: ApprovalItem) {
  return t('approvalsPage.deploymentTitle', {
    shortId: item.deploymentId.slice(0, 8),
    env: item.deployment?.environment?.name ?? '?',
  });
}

function applicantLine(item: ApprovalItem) {
  return t('approvalsPage.applicantLine', {
    name: item.requestedBy?.name ?? t('common.unknown'),
    branch: item.deployment?.branch ?? '—',
    commit: item.deployment?.commitMessage ?? '—',
  });
}

async function review(id: string, decision: 'approved' | 'rejected') {
  await approvalsApi.reviewApproval(id, { decision });
  message.success(decision === 'approved' ? t('approvalsPage.toastApproved') : t('approvalsPage.toastRejected'));
  await load();
}

async function load() {
  loading.value = true;
  try {
    const all = await approvalsApi.listApprovals();
    pendingItems.value = all.filter((a) => a.status === 'pending');
    histItems.value = all.filter((a) => a.status !== 'pending');
  } finally {
    loading.value = false;
  }
}

watch(orgSlug, () => {
  void load();
}, { immediate: true });
</script>

<style scoped>
.approval-pending-card {
  min-width: 0;
}
</style>
