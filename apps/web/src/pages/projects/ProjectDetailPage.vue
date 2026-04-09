<template>
  <div>
    <n-page-header :title="project?.name ?? '...'" @back="router.push(`/orgs/${orgSlug}/projects`)">
      <template #extra>
        <n-button @click="router.push(`/orgs/${orgSlug}/projects/${projectSlug}/settings`)">
          设置
        </n-button>
      </template>
      <template #subtitle>
        <n-text depth="3">{{ project?.repoFullName }}</n-text>
      </template>
    </n-page-header>

    <n-tabs style="margin-top: 16px">
      <n-tab-pane name="overview" tab="概览">
        <!-- 环境列表 -->
        <n-grid :cols="2" :x-gap="16" :y-gap="16" style="margin-top: 8px">
          <n-grid-item v-for="env in project?.environments" :key="env.id">
            <n-card :title="env.name" size="small">
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <n-tag size="small">{{ env.triggerBranch }}</n-tag>
                <n-tag size="small" :type="env.protected ? 'error' : 'default'">
                  {{ env.protected ? '🔒 受保护' : '开放' }}
                </n-tag>
              </div>
              <div style="margin-top: 12px; display: flex; gap: 8px">
                <n-button size="small" type="primary" @click="triggerDeploy(env.id)">
                  立即部署
                </n-button>
                <n-button size="small" @click="router.push(`/orgs/${orgSlug}/projects/${projectSlug}/environments`)">
                  环境管理
                </n-button>
              </div>
            </n-card>
          </n-grid-item>
        </n-grid>
      </n-tab-pane>

      <n-tab-pane name="deployments" tab="部署历史">
        <n-data-table
          :columns="deployColumns"
          :data="deployments"
          :loading="deploymentsLoading"
          :pagination="{ pageSize: 20 }"
          size="small"
          style="margin-top: 8px"
        />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NTabs, NTabPane, NGrid, NGridItem, NCard,
  NTag, NButton, NText, NDataTable, useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { http } from '../../api/client';
import { formatDuration } from '@shipyard/shared';

interface Deployment {
  id: string;
  branch: string;
  commitMessage: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  environment?: { name: string };
  artifactId: string | null;
}

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgSlug = route.params['orgSlug'] as string;
const projectSlug = route.params['projectSlug'] as string;
const project = ref<{ name: string; repoFullName: string; environments: { id: string; name: string; triggerBranch: string; protected: boolean }[] } | null>(null);
const deployments = ref<Deployment[]>([]);
const deploymentsLoading = ref(false);

const statusMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  success: 'success', failed: 'error', building: 'warning',
  deploying: 'info', queued: 'default', pending_approval: 'warning',
};

const deployColumns: DataTableColumns<Deployment> = [
  { title: '环境', key: 'env', render: (r) => r.environment?.name ?? 'Preview', width: 100 },
  { title: '分支', key: 'branch', width: 120 },
  { title: 'Commit', key: 'commitMessage', ellipsis: { tooltip: true } },
  {
    title: '状态', key: 'status', width: 120,
    render: (r) => h(NTag, { type: statusMap[r.status] ?? 'default', size: 'small' }, { default: () => r.status }),
  },
  {
    title: '耗时', key: 'duration', width: 80,
    render: (r) => r.durationMs ? formatDuration(r.durationMs) : '—',
  },
  {
    title: '操作', key: 'actions', width: 140,
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'tiny', onClick: () => router.push(`/orgs/${orgSlug}/projects/${projectSlug}/deployments/${r.id}`) }, { default: () => '日志' }),
      r.artifactId
        ? h(NButton, { size: 'tiny', type: 'warning', onClick: () => rollback(r.id) }, { default: () => '回滚' })
        : h(NButton, { size: 'tiny', disabled: true }, { default: () => '回滚' }),
    ]),
  },
];

async function triggerDeploy(environmentId: string) {
  try {
    await http.post(`/orgs/${orgSlug}/projects/${projectSlug}/deploy`, { environmentId });
    message.success('部署已入队');
    await loadDeployments();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '触发部署失败');
  }
}

async function rollback(deploymentId: string) {
  try {
    await http.post(`/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}/rollback`);
    message.success('回滚已入队');
    await loadDeployments();
  } catch {
    message.error('回滚失败');
  }
}

async function loadDeployments() {
  deploymentsLoading.value = true;
  deployments.value = await http
    .get<Deployment[]>(`/orgs/${orgSlug}/projects/${projectSlug}/deployments`)
    .then((r) => r.data)
    .finally(() => { deploymentsLoading.value = false; });
}

onMounted(async () => {
  [project.value] = await Promise.all([
    http.get(`/orgs/${orgSlug}/projects/${projectSlug}`).then((r) => r.data),
    loadDeployments(),
  ]);
});
</script>
