<template>
  <div>
    <n-page-header title="项目列表">
      <template #extra>
        <n-button type="primary" @click="router.push(`/orgs/${orgSlug}/projects/new`)">
          + 新建项目
        </n-button>
      </template>
    </n-page-header>

    <n-spin :show="loading">
      <n-grid :cols="3" :x-gap="16" :y-gap="16" style="margin-top: 16px">
        <n-grid-item v-for="p in projects" :key="p.id">
          <n-card hoverable @click="router.push(`/orgs/${orgSlug}/projects/${p.slug}`)">
            <div style="display: flex; justify-content: space-between; align-items: flex-start">
              <div>
                <div style="font-size: 16px; font-weight: 600">{{ p.name }}</div>
                <n-text depth="3" style="font-size: 12px">{{ p.repoFullName }}</n-text>
              </div>
              <n-tag size="small" :type="p.frameworkType === 'ssr' ? 'info' : 'default'">
                {{ p.frameworkType }}
              </n-tag>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px">
              <div style="font-size: 12px; color: var(--n-text-color-3)">
                {{ p.environments.length }} 个环境 · {{ p._count.deployments }} 次部署
              </div>
              <n-space size="small">
                <n-button size="tiny" @click.stop="openEdit(p)">编辑</n-button>
                <n-button size="tiny" type="error" @click.stop="confirmDelete(p)">移除</n-button>
              </n-space>
            </div>
          </n-card>
        </n-grid-item>
      </n-grid>
      <n-empty v-if="!loading && projects.length === 0" description="暂无项目" style="margin-top: 40px" />
    </n-spin>

    <project-edit-modal
      v-model:show="showEdit"
      :saving="saving"
      :initial="editInitial"
      @save="saveEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import {
  NPageHeader,
  NGrid,
  NGridItem,
  NCard,
  NText,
  NTag,
  NSpin,
  NEmpty,
  NButton,
  NSpace,
  useDialog,
  useMessage,
} from 'naive-ui';
import {
  useProjectListPageActions,
  type ProjectListItem,
  type ProjectDetail,
} from '@/composables/projects/useProjectListPageActions';
import { useProjectListQuery } from '@/composables/projects/useProjectListQuery';
import ProjectEditModal, { type ProjectEditFormValues } from './components/ProjectEditModal.vue';
import { URL_SLUG_VALIDATION_MESSAGE, isValidUrlSlug } from '@shipyard/shared';

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const listActions = useProjectListPageActions(orgSlug);
const { data: projectsData, isPending: loading } = useProjectListQuery(orgSlug);
const projects = computed(() => projectsData.value ?? []);
const message = useMessage();
const dialog = useDialog();

const showEdit = ref(false);
const saving = ref(false);
const editing = ref<ProjectListItem | null>(null);
const editingDetail = ref<ProjectDetail | null>(null);
const editInitial = ref<ProjectEditFormValues>({
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
});

async function openEdit(p: ProjectListItem) {
  editing.value = p;
  try {
    editingDetail.value = await listActions.fetchProjectDetail(p.slug);
    const pc = editingDetail.value.pipelineConfig;
    editInitial.value = {
      name: editingDetail.value.name,
      slug: editingDetail.value.slug,
      frameworkType: editingDetail.value.frameworkType,
      installCommand: pc?.installCommand ?? 'pnpm install',
      buildCommand: pc?.buildCommand ?? 'pnpm build',
      lintCommand: pc?.lintCommand ?? '',
      testCommand: pc?.testCommand ?? '',
      outputDir: pc?.outputDir ?? 'dist',
      nodeVersion: pc?.nodeVersion ?? '20',
      cacheEnabled: pc?.cacheEnabled ?? true,
      timeoutSeconds: pc?.timeoutSeconds ?? 900,
      ssrEntryPoint: pc?.ssrEntryPoint ?? 'dist/index.js',
    };
    showEdit.value = true;
  } catch {
    message.error('加载项目失败');
    editing.value = null;
    editingDetail.value = null;
  }
}

function confirmDelete(p: ProjectListItem) {
  dialog.warning({
    title: '确认移除项目？',
    content: `将移除「${p.name}」，并删除其环境、部署记录等数据，且无法恢复。`,
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await listActions.deleteProject(p.slug);
      message.success('项目已移除');
      await queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

async function saveEdit(v: ProjectEditFormValues) {
  if (!editing.value) return;
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
  saving.value = true;
  const slugBefore = editing.value.slug;
  try {
    await listActions.updateProject(slugBefore, {
      name: v.name,
      slug: v.slug,
      frameworkType: v.frameworkType,
    });
    const slugAfter = v.slug;

    if (editingDetail.value?.pipelineConfig) {
      await listActions.updatePipelineConfig(slugAfter, {
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

    message.success('已保存');
    showEdit.value = false;
    editing.value = null;
    editingDetail.value = null;
    await queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '保存失败');
  } finally {
    saving.value = false;
  }
}

</script>
