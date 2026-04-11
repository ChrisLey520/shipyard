<template>
  <div>
    <n-page-header :title="project?.name ?? '...'" @back="router.push(`/orgs/${orgSlug}/projects`)">
      <template #extra>
        <n-space>
          <n-button @click="openEditProject">编辑</n-button>
          <n-button type="error" @click="confirmDeleteProject">移除</n-button>
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

    <n-tabs
      v-model:value="activeProjectTab"
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
            <n-button size="small" @click="openBuildEnvModal">管理</n-button>
          </n-space>
          <div style="margin-top: 8px">
            <n-tag size="small">{{ buildEnvVars.length }} keys</n-tag>
          </div>
        </n-card>

        <n-card title="环境" size="small" style="margin-top: 16px">
          <template #header-extra>
            <n-button size="small" @click="router.push(`/orgs/${orgSlug}/projects/${projectSlug}/environments`)">
              环境管理
            </n-button>
          </template>
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
            <n-card
              :title="env.name"
              size="small"
              style="cursor: pointer"
              @click="goEnvDetail(env.id)"
            >
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
                  <n-a :href="envAccessUrls[env.id]!" target="_blank" rel="noopener noreferrer" @click.stop>
                    {{ envAccessUrls[env.id] }}
                  </n-a>
                </template>
                <template v-else> - </template>
              </n-text>
              <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end">
                <n-button size="small" type="primary" @click.stop="triggerDeploy(env.id)">
                  立即部署
                </n-button>
                <n-button size="small" secondary @click.stop="openEditEnv(env.id)">
                  编辑
                </n-button>
              </div>
            </n-card>
          </n-grid-item>
        </n-grid>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="notifications" tab="通知">
        <project-notifications-panel :org-slug="orgSlug" :project-slug="projectSlug" />
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
    </n-tabs>

    <n-modal
      v-model:show="showBuildEnvModal"
      title="构建环境变量（项目级）"
      preset="card"
      style="width: 620px"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-data-table :columns="buildEnvColumns" :data="buildEnvVars" size="small" />
      <div style="margin-top: 12px; display: flex; gap: 8px">
        <n-input v-model:value="newBuildEnv.key" placeholder="KEY" style="width: 200px" />
        <n-input v-model:value="newBuildEnv.value" type="password" placeholder="value" style="flex:1" />
        <n-button type="primary" @click="addBuildEnv">添加</n-button>
      </div>
    </n-modal>

    <project-edit-modal
      v-model:show="showEditProject"
      :saving="savingProject"
      :initial="editProjectInitial"
      :server-options="previewServerOptions"
      @save="saveProject"
    />

    <environment-modal
      v-model:show="showEditEnv"
      mode="edit"
      :org-slug="orgSlug"
      :project-slug="projectSlug"
      :initial-env="editingEnv"
      @saved="onEnvSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NTabs, NTabPane, NGrid, NGridItem, NCard,
  NTag, NButton, NText, NDataTable, useMessage, NEmpty, NSpace, NDescriptions, NDescriptionsItem, NA,
  type DataTableColumns,
  NModal, NInput, useDialog,
} from 'naive-ui';
import ProjectEditModal, { type ProjectEditFormValues } from './components/ProjectEditModal.vue';
import {
  URL_SLUG_VALIDATION_MESSAGE,
  deploymentStatusKey,
  formatDuration,
  isValidUrlSlug,
} from '@shipyard/shared';
import { useI18n } from 'vue-i18n';
import EnvironmentModal from '../environments/components/EnvironmentModal.vue';
import ProjectNotificationsPanel from './components/ProjectNotificationsPanel.vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useProjectDetailQuery } from '@/composables/projects/useProjectDetailQuery';
import { useProjectDeploymentsQuery } from '@/composables/projects/useProjectDeploymentsQuery';
import {
  useProjectDetailActions,
  type ProjectBuildEnvVar,
  type DeploymentListItem,
  type ProjectDetail,
} from '@/composables/projects/useProjectDetailActions';
import { listServers } from '@/api/servers';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const queryClient = useQueryClient();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const projectSlug = computed(() => route.params['projectSlug'] as string);
const projectApi = useProjectDetailActions(orgSlug, projectSlug);
const projectDetailQuery = useProjectDetailQuery(orgSlug, projectSlug);
const deploymentsQuery = useProjectDeploymentsQuery(orgSlug, projectSlug);
const project = computed<ProjectDetail | null>(() => projectDetailQuery.data.value ?? null);
const deployments = computed<DeploymentListItem[]>(() => deploymentsQuery.data.value ?? []);
const deploymentsLoading = computed(
  () => deploymentsQuery.isPending.value || deploymentsQuery.isFetching.value,
);

const dialog = useDialog();
const envAccessUrls = ref<Record<string, string | null>>({});
const checkedDeploymentIds = ref<Array<string | number>>([]);

/** 与路由 ?tab= 同步，避免刷新后总是回到「概览」 */
const activeProjectTab = ref<'overview' | 'deployments' | 'notifications'>('overview');

function syncProjectTabFromRoute() {
  const tab = route.query['tab'];
  if (tab === 'deployments') activeProjectTab.value = 'deployments';
  else if (tab === 'notifications') activeProjectTab.value = 'notifications';
  else activeProjectTab.value = 'overview';
}

function onProjectTabChange(name: string) {
  const next = { ...route.query };
  if (name === 'overview') {
    delete next.tab;
  } else {
    next.tab = name;
  }
  void router.replace({ path: route.path, query: next });
}

const showBuildEnvModal = ref(false);
const buildEnvVars = ref<ProjectBuildEnvVar[]>([]);
const newBuildEnv = ref({ key: '', value: '' });

const buildEnvColumns: DataTableColumns<ProjectBuildEnvVar> = [
  { title: 'KEY', key: 'key' },
  {
    title: '操作', key: 'actions', width: 80,
    render: (r) => h(NButton, { size: 'tiny', type: 'error', onClick: () => deleteBuildEnv(r.id) }, { default: () => '删除' }),
  },
];

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
          { size: 'tiny', type: 'error', secondary: true, onClick: () => confirmDeleteDeployment(r.id) },
          { default: () => '删除' },
        ),
      ]),
  },
];

function clearSelection() {
  checkedDeploymentIds.value = [];
}

function confirmDeleteDeployment(deploymentId: string) {
  dialog.warning({
    title: '确认删除该部署记录？',
    content: '删除后将移除该条部署记录及其日志/产物记录，且无法恢复。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await projectApi.deleteDeployment(deploymentId);
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
  dialog.warning({
    title: '确认批量删除？',
    content: `将删除 ${ids.length} 条部署记录，且无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await projectApi.bulkDeleteDeployments(ids);
      message.success(`已删除 ${res.deleted} 条`);
      clearSelection();
      await refetchDeployments();
      void loadEnvAccessUrls();
    },
  });
}

function confirmClearDeployments() {
  dialog.warning({
    title: '确认清空部署历史？',
    content: '将删除该项目的全部部署记录（含日志），且无法恢复。',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: async () => {
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
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '触发部署失败');
  }
}

const showEditEnv = ref(false);
const editingEnvId = ref<string | null>(null);
const editingEnv = computed(() => {
  if (!editingEnvId.value) return null;
  return project.value?.environments.find((e) => e.id === editingEnvId.value) ?? null;
});

function openEditEnv(envId: string) {
  editingEnvId.value = envId;
  showEditEnv.value = true;
}

function goEnvDetail(envId: string) {
  void router.push(
    `/orgs/${orgSlug.value}/projects/${projectSlug.value}/environments?envId=${encodeURIComponent(envId)}`,
  );
}

async function onEnvSaved() {
  showEditEnv.value = false;
  editingEnvId.value = null;
  await projectDetailQuery.refetch();
  void queryClient.invalidateQueries({ queryKey: ['projects', 'list', orgSlug.value] });
  void loadEnvAccessUrls();
}

async function loadEnvAccessUrls() {
  if (!project.value) return;
  envAccessUrls.value = await projectApi.fetchEnvironmentAccessUrls().catch(() => ({}));
}

let envAccessPollTimer: number | null = null;
watch(
  activeProjectTab,
  (tab) => {
    if (envAccessPollTimer != null) {
      window.clearInterval(envAccessPollTimer);
      envAccessPollTimer = null;
    }
    if (tab !== 'overview') return;
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
    message.error('回滚失败');
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
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '重试失败');
  }
}

function openBuildEnvModal() {
  showBuildEnvModal.value = true;
  void loadBuildEnv();
}

async function loadBuildEnv() {
  buildEnvVars.value = await projectApi.listProjectBuildEnv();
}

async function addBuildEnv() {
  if (!newBuildEnv.value.key || !newBuildEnv.value.value) return;
  await projectApi.upsertProjectBuildEnv(newBuildEnv.value);
  newBuildEnv.value = { key: '', value: '' };
  await loadBuildEnv();
  message.success('已添加');
}

async function deleteBuildEnv(varId: string) {
  await projectApi.deleteProjectBuildEnv(varId);
  await loadBuildEnv();
  message.success('已删除');
}

// ─── 项目编辑 / 移除 ─────────────────────────────────────────────────────────

const showEditProject = ref(false);
const savingProject = ref(false);
const previewServerOptions = ref<{ label: string; value: string }[]>([]);
const editProjectInitial = ref<ProjectEditFormValues>({
  name: '',
  slug: '',
  frameworkType: 'static',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  lintCommand: '',
  testCommand: '',
  outputDir: 'dist',
  nodeVersion: '20',
  cacheEnabled: true,
  timeoutSeconds: 900,
  ssrEntryPoint: 'dist/index.js',
  previewEnabled: false,
  previewServerId: null,
  previewBaseDomain: '',
});

async function loadPreviewServerOptions() {
  try {
    const list = await listServers(orgSlug.value);
    previewServerOptions.value = list.map((s) => ({
      label: `${s.name} (${s.host})`,
      value: s.id,
    }));
  } catch {
    previewServerOptions.value = [];
  }
}

async function openEditProject() {
  await loadPreviewServerOptions();
  const pc = project.value?.pipelineConfig;
  const p = project.value;
  editProjectInitial.value = {
    name: p?.name ?? '',
    slug: p?.slug ?? '',
    frameworkType: p?.frameworkType ?? 'static',
    installCommand: pc?.installCommand ?? 'pnpm install',
    buildCommand: pc?.buildCommand ?? 'pnpm build',
    lintCommand: pc?.lintCommand ?? '',
    testCommand: pc?.testCommand ?? '',
    outputDir: pc?.outputDir ?? 'dist',
    nodeVersion: pc?.nodeVersion ?? '20',
    cacheEnabled: pc?.cacheEnabled ?? true,
    timeoutSeconds: pc?.timeoutSeconds ?? 900,
    ssrEntryPoint: pc?.ssrEntryPoint ?? 'dist/index.js',
    previewEnabled: p?.previewEnabled ?? false,
    previewServerId: p?.previewServerId ?? null,
    previewBaseDomain: p?.previewBaseDomain ?? '',
  };
  showEditProject.value = true;
}

async function saveProject(v: ProjectEditFormValues) {
  if (!v.name || !v.slug) return;
  if (!isValidUrlSlug(v.slug)) {
    message.error(URL_SLUG_VALIDATION_MESSAGE);
    return;
  }
  if (!v.installCommand.trim() || !v.buildCommand.trim() || !v.outputDir.trim()) {
    message.error('请填写安装命令、构建命令与输出目录');
    return;
  }
  if (v.timeoutSeconds == null || v.timeoutSeconds < 60) {
    message.error('构建超时至少 60 秒');
    return;
  }
  if (v.previewEnabled) {
    if (!v.previewServerId) {
      message.error('启用 PR 预览时请选择一个预览服务器');
      return;
    }
    if (!v.previewBaseDomain.trim()) {
      message.error('请填写预览父域（如 preview.example.com）');
      return;
    }
  }
  savingProject.value = true;
  const slugBefore = projectSlug.value;
  try {
    await projectApi.updateProject(slugBefore, {
      name: v.name,
      slug: v.slug,
      frameworkType: v.frameworkType,
      previewEnabled: v.previewEnabled,
      previewServerId: v.previewEnabled ? v.previewServerId : null,
      previewBaseDomain: v.previewEnabled ? v.previewBaseDomain.trim() : null,
    });
    const slugAfter = v.slug;

    if (project.value?.pipelineConfig) {
      await projectApi.updatePipelineConfig(slugAfter, {
        installCommand: v.installCommand.trim(),
        buildCommand: v.buildCommand.trim(),
        outputDir: v.outputDir.trim(),
        nodeVersion: v.nodeVersion,
        cacheEnabled: v.cacheEnabled,
        timeoutSeconds: v.timeoutSeconds,
        lintCommand: v.lintCommand.trim() ? v.lintCommand.trim() : null,
        testCommand: v.testCommand.trim() ? v.testCommand.trim() : null,
        ssrEntryPoint: v.frameworkType === 'ssr' ? (v.ssrEntryPoint.trim() || null) : null,
      });
    }

    showEditProject.value = false;
    message.success('已保存');
    void queryClient.invalidateQueries({ queryKey: ['projects', 'list', orgSlug.value] });
    if (v.slug !== slugBefore) {
      void queryClient.invalidateQueries({ queryKey: ['projects', 'detail', orgSlug.value, slugBefore] });
      void queryClient.invalidateQueries({ queryKey: ['projects', 'deployments', orgSlug.value, slugBefore] });
      await router.replace(`/orgs/${orgSlug.value}/projects/${v.slug}`);
      await nextTick();
    }
    await projectDetailQuery.refetch();
    await refetchDeployments();
    await loadBuildEnv();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '保存失败');
  } finally {
    savingProject.value = false;
  }
}

function confirmDeleteProject() {
  dialog.warning({
    title: '确认移除项目？',
    content: '项目移除后将删除其环境、部署记录等数据，且无法恢复。',
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await projectApi.deleteProject();
      message.success('项目已移除');
      void queryClient.invalidateQueries({ queryKey: ['projects', 'list', orgSlug.value] });
      void router.push(`/orgs/${orgSlug.value}/projects`);
    },
  });
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

watch(
  () => route.query.tab,
  () => syncProjectTabFromRoute(),
);

onMounted(() => {
  syncProjectTabFromRoute();
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
