<template>
  <div>
    <n-page-header :title="project?.name ?? '...'" @back="router.push(`/orgs/${orgSlug}/projects`)">
      <template #subtitle>
        <n-text depth="3">{{ project?.repoFullName }}</n-text>
      </template>
    </n-page-header>

    <n-tabs
      :value="activeProjectTab"
      style="margin-top: 16px"
      @update:value="onProjectTabChange"
    >
      <n-tab-pane name="overview" tab="概览">
        <n-grid :cols="2" :x-gap="16" :y-gap="16" class="overview-top-grid" style="margin-top: 8px">
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

          <n-grid-item v-if="project?.gitConnection?.gitProvider === 'github'" class="overview-top-grid-item">
            <n-card title="PR 预览" size="small" class="overview-top-card">
              <n-descriptions label-placement="left" :column="1" size="small">
                <n-descriptions-item label="状态">
                  {{ project?.previewEnabled ? '已启用' : '未启用' }}
                </n-descriptions-item>
                <n-descriptions-item label="服务器">
                  {{ project?.previewServer?.name ?? '—' }}
                </n-descriptions-item>
                <n-descriptions-item label="父域">
                  {{ project?.previewBaseDomain ?? '—' }}
                </n-descriptions-item>
              </n-descriptions>
            </n-card>
          </n-grid-item>
        </n-grid>

        <n-card title="构建环境变量（项目级）" size="small" style="margin-top: 16px">
          <n-space justify="space-between" align="center">
            <n-text depth="3">用于构建阶段（install/build）。环境级变量会覆盖同名项目变量。</n-text>
            <n-button size="small" @click="goProjectSettings">前往项目设置</n-button>
          </n-space>
          <div style="margin-top: 8px">
            <n-tag size="small">{{ buildEnvVars.length }} keys</n-tag>
          </div>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="environments" tab="环境">
        <n-card title="部署环境" size="small" style="margin-top: 8px">
          <template #header-extra>
            <n-button type="primary" size="small" @click="openCreateEnv">添加环境</n-button>
          </template>
          <n-empty
            v-if="!project || project.environments.length === 0"
            description="还没有部署环境"
          >
            <template #extra>
              <n-button type="primary" @click="openCreateEnv">添加环境</n-button>
            </template>
          </n-empty>
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
                <n-text depth="3" style="display:block;margin-top:6px;font-size:12px">
                  访问地址：
                  <template v-if="envAccessUrls[env.id]">
                    <n-a :href="envAccessUrls[env.id]!" target="_blank" rel="noopener noreferrer">
                      {{ envAccessUrls[env.id] }}
                    </n-a>
                  </template>
                  <template v-else> - </template>
                </n-text>
                <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end">
                  <n-button size="small" type="primary" @click="triggerDeploy(env.id)">
                    立即部署
                  </n-button>
                  <n-button size="small" secondary @click="openEnvVarModal(env)">环境变量</n-button>
                  <n-button size="small" secondary @click="openEditEnv(env.id)">编辑</n-button>
                  <n-button size="small" type="error" secondary @click="confirmDeleteEnv(env)">删除</n-button>
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="notifications" tab="通知">
        <project-notifications-panel :org-slug="orgSlug" :project-slug="projectSlug" />
      </n-tab-pane>

      <n-tab-pane name="feature-flags" tab="特性开关">
        <project-feature-flags-panel :org-slug="orgSlug" :project-slug="projectSlug" />
      </n-tab-pane>

      <n-tab-pane name="deployments" tab="部署历史">
        <n-space justify="space-between" align="center" style="margin-top: 8px">
          <n-space>
            <n-button
              size="small"
              type="error"
              :disabled="checkedDeploymentIds.length === 0"
              @click="confirmBulkDeleteDeployments"
            >
              批量删除（{{ checkedDeploymentIds.length }}）
            </n-button>
            <n-button size="small" secondary @click="clearSelection">清空选择</n-button>
          </n-space>
          <n-button size="small" type="error" secondary @click="confirmClearDeployments">
            清空部署历史
          </n-button>
        </n-space>
        <n-data-table
          :columns="deployColumns"
          :data="deployments"
          :loading="deploymentsLoading"
          :pagination="{ pageSize: 20 }"
          :row-key="(row) => row.id"
          v-model:checked-row-keys="checkedDeploymentIds"
          size="small"
          style="margin-top: 8px"
        />
      </n-tab-pane>

      <n-tab-pane name="settings" tab="设置">
        <project-settings-panel />
      </n-tab-pane>
    </n-tabs>

    <environment-modal
      v-model:show="showEnvModal"
      :mode="envFormMode"
      :org-slug="orgSlug"
      :project-slug="projectSlug"
      :initial-env="editingEnvForModal"
      @saved="onEnvModalSaved"
    />

    <n-modal
      v-model:show="showEnvVarModal"
      :title="envVarModalTitle"
      preset="card"
      style="width: min(100%, 600px)"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-data-table :columns="envVarColumns" :data="envVarsList" size="small" />
      <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap">
        <n-input v-model:value="newEnvVar.key" placeholder="KEY" style="width: 180px" />
        <n-input v-model:value="newEnvVar.value" type="password" placeholder="value" style="flex: 1; min-width: 140px" />
        <n-button type="primary" @click="addEnvVar">添加</n-button>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NTabs, NTabPane, NGrid, NGridItem, NCard,
  NTag, NButton, NText, NDataTable, useMessage, NEmpty, NSpace, NDescriptions, NDescriptionsItem, NA,
  NModal, NInput,
  type DataTableColumns,
} from 'naive-ui';
import { deploymentStatusKey, formatDuration } from '@shipyard/shared';
import { useI18n } from 'vue-i18n';
import EnvironmentModal from './components/EnvironmentModal.vue';
import ProjectNotificationsPanel from './components/ProjectNotificationsPanel.vue';
import ProjectFeatureFlagsPanel from './components/ProjectFeatureFlagsPanel.vue';
import ProjectSettingsPanel from './components/ProjectSettingsPanel.vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useProjectDetailQuery } from '@/composables/projects/useProjectDetailQuery';
import { useProjectDeploymentsQuery } from '@/composables/projects/useProjectDeploymentsQuery';
import {
  useProjectDetailActions,
  type ProjectBuildEnvVar,
  type DeploymentListItem,
  type ProjectDetail,
} from '@/composables/projects/useProjectDetailActions';
import type { Env, EnvVar } from '@/api/projects/environments';
import { useEnvironmentsProjectActions } from '@/composables/projects/useEnvironmentsProjectActions';
import { openDestructiveNameConfirm } from '@/ui/destructiveNameConfirm';
import {
  type ProjectDetailTab,
  DEFAULT_PROJECT_DETAIL_TAB,
  isProjectDetailTab,
  projectDetailTabPath,
} from './projectDetailTabs';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const queryClient = useQueryClient();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const projectSlug = computed(() => route.params['projectSlug'] as string);
const projectApi = useProjectDetailActions(orgSlug, projectSlug);
const envProjectApi = useEnvironmentsProjectActions(orgSlug, projectSlug);
const projectDetailQuery = useProjectDetailQuery(orgSlug, projectSlug);
const deploymentsQuery = useProjectDeploymentsQuery(orgSlug, projectSlug);
const project = computed<ProjectDetail | null>(() => projectDetailQuery.data.value ?? null);
const deployments = computed<DeploymentListItem[]>(() => deploymentsQuery.data.value ?? []);
const deploymentsLoading = computed(
  () => deploymentsQuery.isPending.value || deploymentsQuery.isFetching.value,
);

const envAccessUrls = ref<Record<string, string | null>>({});
const checkedDeploymentIds = ref<Array<string | number>>([]);

const activeProjectTab = computed<ProjectDetailTab>(() => {
  const seg = route.params['tab'];
  return typeof seg === 'string' && isProjectDetailTab(seg) ? seg : DEFAULT_PROJECT_DETAIL_TAB;
});

function onProjectTabChange(name: string) {
  if (!isProjectDetailTab(name)) return;
  void router.push(projectDetailTabPath(orgSlug.value, projectSlug.value, name));
}

const buildEnvVars = ref<ProjectBuildEnvVar[]>([]);

const statusMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  success: 'success',
  failed: 'error',
  building: 'warning',
  deploying: 'info',
  queued: 'default',
  pending_approval: 'warning',
  cancelled: 'default',
};

const { t } = useI18n();

const deployColumns: DataTableColumns<DeploymentListItem> = [
  { type: 'selection' },
  { title: '环境', key: 'env', render: (r) => r.environment?.name ?? 'Preview', width: 100 },
  { title: '分支', key: 'branch', width: 120 },
  { title: 'Commit', key: 'commitMessage', ellipsis: { tooltip: true } },
  {
    title: '状态', key: 'status', width: 120,
    render: (r) =>
      h(
        NTag,
        { type: statusMap[r.status] ?? 'default', size: 'small' },
        { default: () => t(deploymentStatusKey(r.status)) },
      ),
  },
  {
    title: '耗时', key: 'duration', width: 80,
    render: (r) => {
      if (r.durationMs != null) return formatDuration(r.durationMs);
      if (['building', 'deploying', 'queued', 'pending_approval'].includes(r.status)) return '进行中';
      return '—';
    },
  },
  {
    title: '操作', key: 'actions', width: 200,
    render: (r) =>
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' }, [
        h(NButton, { size: 'tiny', onClick: () => router.push(`/orgs/${orgSlug.value}/projects/${projectSlug.value}/deployments/${r.id}`) }, { default: () => '详情' }),
        r.status === 'failed'
          ? h(NButton, { size: 'tiny', type: 'primary', secondary: true, onClick: () => retryFailed(r.id) }, { default: () => '重试' })
          : null,
        r.artifactId
          ? h(NButton, { size: 'tiny', type: 'warning', onClick: () => rollback(r.id) }, { default: () => '回滚' })
          : h(NButton, { size: 'tiny', disabled: true }, { default: () => '回滚' }),
        h(
          NButton,
          { size: 'tiny', type: 'error', secondary: true, onClick: () => confirmDeleteDeployment(r) },
          { default: () => '删除' },
        ),
      ]),
  },
];

function clearSelection() {
  checkedDeploymentIds.value = [];
}

function confirmDeleteDeployment(row: DeploymentListItem) {
  openDestructiveNameConfirm({
    title: '删除该部署记录？',
    description: `环境：${row.environment?.name ?? '—'}，分支：${row.branch}。删除后将移除该条部署记录及其日志/产物记录，且无法恢复。`,
    expected: row.id,
    expectedLabel: '部署 ID',
    positiveText: '删除',
    onConfirm: async () => {
      await projectApi.deleteDeployment(row.id);
      message.success('已删除');
      clearSelection();
      await refetchDeployments();
      void loadEnvAccessUrls();
    },
  });
}

function confirmBulkDeleteDeployments() {
  const ids = checkedDeploymentIds.value.filter((x): x is string => typeof x === 'string');
  if (ids.length === 0) return;
  const slug = projectSlug.value;
  openDestructiveNameConfirm({
    title: '批量删除部署记录？',
    description: `将删除已选中的 ${ids.length} 条部署记录，且无法恢复。`,
    expected: slug,
    expectedLabel: '项目 URL 标识（slug）',
    positiveText: '删除',
    onConfirm: async () => {
      const res = await projectApi.bulkDeleteDeployments(ids);
      message.success(`已删除 ${res.deleted} 条`);
      clearSelection();
      await refetchDeployments();
      void loadEnvAccessUrls();
    },
  });
}

function confirmClearDeployments() {
  const slug = projectSlug.value;
  openDestructiveNameConfirm({
    title: '清空部署历史？',
    description: '将删除该项目的全部部署记录（含日志），且无法恢复。',
    expected: slug,
    expectedLabel: '项目 URL 标识（slug）',
    positiveText: '清空',
    onConfirm: async () => {
      const res = await projectApi.clearDeployments();
      message.success(`已清空 ${res.deleted} 条`);
      clearSelection();
      await refetchDeployments();
      void loadEnvAccessUrls();
    },
  });
}

async function triggerDeploy(environmentId: string) {
  try {
    await projectApi.triggerDeploy({ environmentId });
    message.success('部署已入队');
    await refetchDeployments();
    void loadEnvAccessUrls();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  }
}

const showEnvModal = ref(false);
const envFormMode = ref<'create' | 'edit'>('create');
const editingEnvId = ref<string | null>(null);

const editingEnvForModal = computed((): Env | null => {
  if (!editingEnvId.value) return null;
  const row = project.value?.environments.find((e) => e.id === editingEnvId.value);
  return row ? (row as unknown as Env) : null;
});

function openCreateEnv() {
  envFormMode.value = 'create';
  editingEnvId.value = null;
  showEnvModal.value = true;
}

function openEditEnv(envId: string) {
  envFormMode.value = 'edit';
  editingEnvId.value = envId;
  showEnvModal.value = true;
}

async function onEnvModalSaved() {
  showEnvModal.value = false;
  editingEnvId.value = null;
  await projectDetailQuery.refetch();
  void queryClient.invalidateQueries({ queryKey: ['projects', 'list', orgSlug.value] });
  void loadEnvAccessUrls();
}

const showEnvVarModal = ref(false);
const selectedEnvForVars = ref<ProjectDetail['environments'][number] | null>(null);
const envVarsList = ref<EnvVar[]>([]);
const newEnvVar = ref({ key: '', value: '' });

const envVarModalTitle = computed(() =>
  selectedEnvForVars.value ? `${selectedEnvForVars.value.name} · 环境变量` : '环境变量',
);

const envVarColumns: DataTableColumns<EnvVar> = [
  { title: 'KEY', key: 'key' },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    render: (r) =>
      h(
        NButton,
        { size: 'tiny', type: 'error', onClick: () => void confirmRemoveEnvVarRow(r) },
        { default: () => '删除' },
      ),
  },
];

function openEnvVarModal(env: ProjectDetail['environments'][number]) {
  selectedEnvForVars.value = env;
  showEnvVarModal.value = true;
  void loadEnvVarsForModal(env.id);
}

async function loadEnvVarsForModal(envId: string) {
  envVarsList.value = await envProjectApi.listEnvVars(envId);
}

async function addEnvVar() {
  if (!newEnvVar.value.key.trim() || !newEnvVar.value.value || !selectedEnvForVars.value) return;
  await envProjectApi.upsertEnvVar(selectedEnvForVars.value.id, {
    key: newEnvVar.value.key.trim(),
    value: newEnvVar.value.value,
  });
  newEnvVar.value = { key: '', value: '' };
  await loadEnvVarsForModal(selectedEnvForVars.value.id);
  message.success('已添加');
}

function confirmRemoveEnvVarRow(row: EnvVar) {
  const env = selectedEnvForVars.value;
  if (!env) return;
  openDestructiveNameConfirm({
    title: '删除环境变量？',
    description: `将从环境「${env.name}」删除变量「${row.key}」。`,
    expected: row.key,
    expectedLabel: '变量名（KEY）',
    positiveText: '删除',
    onConfirm: async () => {
      await envProjectApi.deleteEnvVar(env.id, row.id);
      await loadEnvVarsForModal(env.id);
      message.success('已删除');
    },
  });
}

function confirmDeleteEnv(env: ProjectDetail['environments'][number]) {
  openDestructiveNameConfirm({
    title: '删除环境？',
    description: `将删除环境「${env.name}」及其变量等关联数据，且无法恢复。`,
    expected: env.name,
    expectedLabel: '环境名称',
    positiveText: '删除',
    onConfirm: async () => {
      await envProjectApi.deleteEnvironment(env.id);
      message.success('已删除');
      await projectDetailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['projects', 'list', orgSlug.value] });
      void loadEnvAccessUrls();
    },
  });
}

async function loadEnvAccessUrls() {
  if (!project.value) return;
  try {
    envAccessUrls.value = await projectApi.fetchEnvironmentAccessUrls();
  } catch {
    envAccessUrls.value = {};
  }
}

let envAccessPollTimer: number | null = null;
watch(
  activeProjectTab,
  (tab) => {
    if (envAccessPollTimer != null) {
      window.clearInterval(envAccessPollTimer);
      envAccessPollTimer = null;
    }
    if (tab !== 'overview' && tab !== 'environments') return;
    void loadEnvAccessUrls();
    envAccessPollTimer = window.setInterval(() => {
      void loadEnvAccessUrls();
    }, 10_000);
  },
  { immediate: true },
);

async function rollback(deploymentId: string) {
  try {
    await projectApi.rollbackDeployment(deploymentId);
    message.success('回滚已入队');
    await refetchDeployments();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  }
}

async function retryFailed(deploymentId: string) {
  try {
    const next = await projectApi.retryDeployment(deploymentId);
    message.success('已重新入队');
    await refetchDeployments();
    if (next?.id) {
      await router.push(`/orgs/${orgSlug.value}/projects/${projectSlug.value}/deployments/${next.id}`);
    }
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  }
}

async function loadBuildEnv() {
  buildEnvVars.value = await projectApi.listProjectBuildEnv();
}

function goProjectSettings() {
  void router.push(projectDetailTabPath(orgSlug.value, projectSlug.value, 'settings'));
}

async function refetchDeployments() {
  await deploymentsQuery.refetch();
}

watch(
  () => project.value?.id,
  (id) => {
    if (!id) return;
    void loadBuildEnv();
    void loadEnvAccessUrls();
  },
  { immediate: true },
);

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
