<template>
  <div>
    <n-page-header :title="project?.name ?? '...'" @back="router.push(`/orgs/${orgSlug}/projects`)">
      <template #extra>
        <n-space>
          <n-button @click="router.push(`/orgs/${orgSlug}/projects/${projectSlug}/environments`)">
            环境管理
          </n-button>
          <n-button @click="router.push(`/orgs/${orgSlug}/projects/${projectSlug}/settings`)">
            设置
          </n-button>
        </n-space>
      </template>
      <template #subtitle>
        <n-text depth="3">{{ project?.repoFullName }}</n-text>
      </template>
    </n-page-header>

    <n-tabs style="margin-top: 16px">
      <n-tab-pane name="overview" tab="概览">
        <n-grid :cols="3" :x-gap="16" :y-gap="16" class="overview-top-grid" style="margin-top: 8px">
          <n-grid-item class="overview-top-grid-item">
            <n-card title="项目信息" size="small" class="overview-top-card">
              <n-descriptions label-placement="left" :column="1" size="small">
                <n-descriptions-item label="Slug">{{ project?.slug ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="框架">{{ project?.frameworkType ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="仓库">{{ project?.repoFullName ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="创建时间">{{ project?.createdAt ? new Date(project.createdAt).toLocaleString() : '—' }}</n-descriptions-item>
              </n-descriptions>
            </n-card>
          </n-grid-item>

          <n-grid-item class="overview-top-grid-item">
            <n-card title="Git 连接" size="small" class="overview-top-card">
              <n-descriptions label-placement="left" :column="1" size="small">
                <n-descriptions-item label="Provider">{{ project?.gitConnection?.gitProvider ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="用户名">{{ project?.gitConnection?.gitUsername ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="状态">{{ project?.gitConnection ? '已绑定' : '未绑定' }}</n-descriptions-item>
              </n-descriptions>
            </n-card>
          </n-grid-item>

          <n-grid-item class="overview-top-grid-item">
            <n-card title="构建配置" size="small" class="overview-top-card">
              <n-descriptions label-placement="left" :column="1" size="small">
                <n-descriptions-item label="Node">{{ project?.pipelineConfig?.nodeVersion ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="安装">{{ project?.pipelineConfig?.installCommand ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="构建">{{ project?.pipelineConfig?.buildCommand ?? '—' }}</n-descriptions-item>
                <n-descriptions-item label="输出">{{ project?.pipelineConfig?.outputDir ?? '—' }}</n-descriptions-item>
              </n-descriptions>
            </n-card>
          </n-grid-item>
        </n-grid>

        <n-card title="环境" size="small" style="margin-top: 16px">
        <n-empty
          v-if="!project || project.environments.length === 0"
          description="还没有部署环境"
          style="margin-top: 8px"
        >
          <template #extra>
            <n-button type="primary" @click="router.push(`/orgs/${orgSlug}/projects/${projectSlug}/environments`)">
              去创建环境
            </n-button>
          </template>
        </n-empty>

        <!-- 环境列表 -->
        <n-grid v-else :cols="2" :x-gap="16" :y-gap="16" style="margin-top: 8px">
          <n-grid-item v-for="env in project.environments" :key="env.id">
            <n-card :title="env.name" size="small">
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <n-tag size="small">{{ env.triggerBranch }}</n-tag>
                <n-tag size="small" :type="env.protected ? 'error' : 'default'">
                  {{ env.protected ? '🔒 受保护' : '开放' }}
                </n-tag>
              </div>
              <n-text depth="3" style="display:block;margin-top:8px;font-size:12px">
                {{ env.server?.name }} ({{ env.server?.host }}) · {{ env.deployPath }}
              </n-text>
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
        </n-card>
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
  NTag, NButton, NText, NDataTable, useMessage, NEmpty, NSpace, NDescriptions, NDescriptionsItem,
  type DataTableColumns,
} from 'naive-ui';
import { formatDuration } from '@shipyard/shared';
import {
  getProject,
  listDeployments,
  triggerDeploy as apiTriggerDeploy,
  rollbackDeployment,
  type DeploymentListItem,
  type ProjectDetail,
} from './api';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgSlug = route.params['orgSlug'] as string;
const projectSlug = route.params['projectSlug'] as string;
const project = ref<ProjectDetail | null>(null);
const deployments = ref<DeploymentListItem[]>([]);
const deploymentsLoading = ref(false);

const statusMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  success: 'success', failed: 'error', building: 'warning',
  deploying: 'info', queued: 'default', pending_approval: 'warning',
};

const deployColumns: DataTableColumns<DeploymentListItem> = [
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
    await apiTriggerDeploy(orgSlug, projectSlug, { environmentId });
    message.success('部署已入队');
    await loadDeployments();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '触发部署失败');
  }
}

async function rollback(deploymentId: string) {
  try {
    await rollbackDeployment(orgSlug, projectSlug, deploymentId);
    message.success('回滚已入队');
    await loadDeployments();
  } catch {
    message.error('回滚失败');
  }
}

async function loadDeployments() {
  deploymentsLoading.value = true;
  try {
    deployments.value = await listDeployments(orgSlug, projectSlug);
  } finally {
    deploymentsLoading.value = false;
  }
}

onMounted(async () => {
  [project.value] = await Promise.all([
    getProject(orgSlug, projectSlug),
    loadDeployments(),
  ]);
});
</script>

<style scoped>
.overview-top-grid {
  align-items: stretch;
}

.overview-top-grid-item {
  display: flex;
}

.overview-top-card {
  flex: 1;
  height: 100%;
}
</style>
