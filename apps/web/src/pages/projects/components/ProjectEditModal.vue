<template>
  <n-modal
    :show="show"
    title="编辑项目"
    preset="card"
    style="width: 620px"
    :mask-closable="false"
    :close-on-esc="false"
    @update:show="(v) => emit('update:show', v)"
  >
    <div class="max-h-[68vh] overflow-y-auto pr-1">
      <project-settings-form-fields
        :form="form"
        :server-options="serverOptions"
        :show-pr-preview-section="showPrPreview"
      />
    </div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="saving" @click="emit('save', snapshotForm())">保存</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, watch, computed } from 'vue';
import { NModal, NSpace, NButton } from 'naive-ui';
import ProjectSettingsFormFields from './ProjectSettingsFormFields.vue';
import { emptyProjectEditForm, type ProjectEditFormValues } from '../projectEditForm';

export type { ProjectEditFormValues };

const props = defineProps<{
  show: boolean;
  saving: boolean;
  initial: ProjectEditFormValues;
  serverOptions?: { label: string; value: string }[];
  /** 与项目设置页一致：仅 GitHub 等展示 PR 预览块 */
  showPrPreviewSection?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'save', v: ProjectEditFormValues): void;
}>();

const showPrPreview = computed(() => props.showPrPreviewSection ?? false);

const form = reactive<ProjectEditFormValues>(emptyProjectEditForm());

function snapshotForm(): ProjectEditFormValues {
  return { ...form };
}

watch(
  () => props.initial,
  (v) => {
    if (!v) return;
    form.name = v.name ?? '';
    form.slug = v.slug ?? '';
    form.frameworkType = (v.frameworkType as 'static' | 'ssr') ?? 'static';
    form.installCommand = v.installCommand ?? 'pnpm install';
    form.buildCommand = v.buildCommand ?? 'pnpm build';
    form.lintCommand = v.lintCommand ?? '';
    form.testCommand = v.testCommand ?? '';
    form.outputDir = v.outputDir ?? 'dist';
    form.nodeVersion = v.nodeVersion ?? '20';
    form.cacheEnabled = v.cacheEnabled ?? true;
    form.timeoutSeconds = typeof v.timeoutSeconds === 'number' ? v.timeoutSeconds : 900;
    form.ssrEntryPoint = v.ssrEntryPoint ?? 'dist/index.js';
    form.previewHealthCheckPath = v.previewHealthCheckPath ?? '';
    form.previewEnabled = v.previewEnabled ?? false;
    form.previewServerId = v.previewServerId ?? null;
    form.previewBaseDomain = v.previewBaseDomain ?? '';
    form.containerImageEnabled = v.containerImageEnabled ?? false;
    form.containerImageName = v.containerImageName ?? '';
    form.registryUsername = v.registryUsername ?? '';
    form.registryPassword = '';
  },
  { immediate: true, deep: true },
);
</script>
