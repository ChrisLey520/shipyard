<template>
  <div class="project-settings-panel">
    <n-spin :show="detailLoading && !project">
      <template v-if="project">
        <n-card title="仓库与 Git" size="small" style="margin-top: 8px">
          <n-descriptions label-placement="left" :column="1" size="small">
            <n-descriptions-item label="仓库">{{ project.repoFullName }}</n-descriptions-item>
            <n-descriptions-item label="Provider">{{ project.gitConnection?.gitProvider ?? '—' }}</n-descriptions-item>
            <n-descriptions-item label="用户名">{{ project.gitConnection?.gitUsername ?? '—' }}</n-descriptions-item>
            <n-descriptions-item label="状态">{{ project.gitConnection ? '已绑定' : '未绑定' }}</n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card title="项目配置" size="small" style="margin-top: 16px">
          <project-settings-form-fields
            :form="form"
            :server-options="previewServerOptions"
            :show-pr-preview-section="project.gitConnection?.gitProvider === 'github'"
          />
          <n-space justify="end" style="margin-top: 16px">
            <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
          </n-space>
        </n-card>

        <n-card title="构建环境变量（项目级）" size="small" style="margin-top: 16px">
          <n-text depth="3" style="display: block; margin-bottom: 8px">
            用于构建阶段（install/build）。环境级变量会覆盖同名项目变量。
          </n-text>
          <n-data-table :columns="buildEnvColumns" :data="buildEnvVars" size="small" />
          <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap">
            <n-input v-model:value="newBuildEnv.key" placeholder="KEY" style="width: 200px" />
            <n-input
              v-model:value="newBuildEnv.value"
              type="password"
              placeholder="value"
              style="flex: 1; min-width: 160px"
            />
            <n-button type="primary" @click="addBuildEnv">添加</n-button>
          </div>
        </n-card>

        <n-card title="危险操作" size="small" style="margin-top: 16px">
          <n-text depth="3">移除项目将删除其环境、部署记录等数据，且无法恢复。</n-text>
          <div style="margin-top: 12px">
            <n-button type="error" @click="confirmDeleteProject">移除项目</n-button>
          </div>
        </n-card>
      </template>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NCard,
  NButton,
  NText,
  NSpin,
  NDescriptions,
  NDescriptionsItem,
  NSpace,
  NDataTable,
  NInput,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { useQueryClient } from '@tanstack/vue-query';
import ProjectSettingsFormFields from './ProjectSettingsFormFields.vue';
import {
  emptyProjectEditForm,
  projectDetailToEditForm,
  type ProjectEditFormValues,
} from '../projectEditForm';
import { useProjectDetailQuery } from '@/composables/projects/useProjectDetailQuery';
import { useProjectDeploymentsQuery } from '@/composables/projects/useProjectDeploymentsQuery';
import {
  useProjectDetailActions,
  type ProjectBuildEnvVar,
  type ProjectDetail,
} from '@/composables/projects/useProjectDetailActions';
import { saveProjectSettings } from '@/composables/projects/useProjectSettingsSave';
import { listServers } from '@/api/servers';
import { openDestructiveNameConfirm } from '@/ui/destructiveNameConfirm';

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
const detailLoading = computed(
  () => projectDetailQuery.isPending.value || projectDetailQuery.isFetching.value,
);

const form = reactive<ProjectEditFormValues>(emptyProjectEditForm());
const saving = ref(false);
const previewServerOptions = ref<{ label: string; value: string }[]>([]);

const buildEnvVars = ref<ProjectBuildEnvVar[]>([]);
const newBuildEnv = ref({ key: '', value: '' });

const buildEnvColumns: DataTableColumns<ProjectBuildEnvVar> = [
  { title: 'KEY', key: 'key' },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    render: (r) =>
      h(NButton, { size: 'tiny', type: 'error', onClick: () => confirmDeleteBuildEnv(r) }, { default: () => '删除' }),
  },
];

watch(
  () => project.value,
  (p) => {
    if (!p) return;
    Object.assign(form, projectDetailToEditForm(p));
  },
  { immediate: true },
);

async function loadPreviewServerOptions() {
  try {
    const list = await listServers(orgSlug.value, { shipyard: { silent: true } });
    previewServerOptions.value = list.map((s) => ({
      label: `${s.name} (${s.host})`,
      value: s.id,
    }));
  } catch {
    previewServerOptions.value = [];
  }
}

void loadPreviewServerOptions();

async function loadBuildEnv() {
  buildEnvVars.value = await projectApi.listProjectBuildEnv();
}

watch(
  () => project.value?.id,
  (id) => {
    if (id) void loadBuildEnv();
  },
  { immediate: true },
);

async function addBuildEnv() {
  if (!newBuildEnv.value.key || !newBuildEnv.value.value) return;
  await projectApi.upsertProjectBuildEnv(newBuildEnv.value);
  newBuildEnv.value = { key: '', value: '' };
  await loadBuildEnv();
  message.success('已添加');
}

function confirmDeleteBuildEnv(row: ProjectBuildEnvVar) {
  openDestructiveNameConfirm({
    title: '删除构建变量？',
    description: `将删除项目级构建变量「${row.key}」，后续构建将不再注入该键。`,
    expected: row.key,
    expectedLabel: '变量名（KEY）',
    positiveText: '删除',
    onConfirm: async () => {
      await projectApi.deleteProjectBuildEnv(row.id);
      await loadBuildEnv();
      message.success('已删除');
    },
  });
}

async function onSave() {
  const v = { ...form };
  saving.value = true;
  try {
    await saveProjectSettings(v, {
      orgSlug: orgSlug.value,
      slugBefore: projectSlug.value,
      project: project.value,
      api: projectApi,
      queryClient,
      router,
      message,
      refetchDetail: () => projectDetailQuery.refetch(),
      refetchDeployments: () => deploymentsQuery.refetch(),
      loadBuildEnv,
      pathAfterSlugChange: (newSlug) =>
        `/orgs/${orgSlug.value}/projects/${newSlug}?tab=settings`,
    });
  } finally {
    saving.value = false;
  }
}

function confirmDeleteProject() {
  const slug = projectSlug.value;
  openDestructiveNameConfirm({
    title: '移除项目？',
    description: '项目移除后将删除其环境、部署记录等数据，且无法恢复。',
    expected: slug,
    expectedLabel: '项目 URL 标识（slug）',
    positiveText: '移除',
    onConfirm: async () => {
      await projectApi.deleteProject();
      message.success('项目已移除');
      void queryClient.invalidateQueries({ queryKey: ['projects', 'list', orgSlug.value] });
      void router.push(`/orgs/${orgSlug.value}/projects`);
    },
  });
}
</script>

<style scoped>
.project-settings-panel {
  max-width: 720px;
}
</style>
