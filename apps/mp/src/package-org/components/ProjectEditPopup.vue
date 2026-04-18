<template>
  <wd-popup
    :model-value="modelValue"
    position="bottom"
    :safe-area-inset-bottom="true"
    @update:model-value="onUpdateShow"
  >
    <scroll-view scroll-y class="max-h-85vh p-4">
      <text class="font-medium">编辑项目</text>
      <wd-input v-model="form.name" class="mt-2" label="名称" />
      <wd-input v-model="form.slug" label="Slug" />
      <picker mode="selector" :range="frameworkOptions" range-key="label" :value="frameworkIndex" @change="onFrameworkChange">
        <wd-cell title="框架类型" :value="frameworkOptions[frameworkIndex]?.label ?? '—'" is-link />
      </picker>
      <view class="h-px bg-gray-200 my-3" />
      <text class="text-sm text-gray-600">构建配置</text>
      <wd-input v-model="form.installCommand" label="安装命令" />
      <wd-input v-model="form.buildCommand" label="构建命令" />
      <wd-input v-model="form.outputDir" label="输出目录" />
      <picker mode="selector" :range="nodeVersionOptions" range-key="label" :value="nodeVersionIndex" @change="onNodeVersionChange">
        <wd-cell title="Node 版本" :value="nodeVersionOptions[nodeVersionIndex]?.label ?? '—'" is-link />
      </picker>
      <wd-input v-model="form.lintCommand" label="Lint（可选）" />
      <wd-input v-model="form.testCommand" label="测试（可选）" />
      <wd-input v-model="form.timeoutSeconds" label="超时(秒)" type="number" />
      <view class="flex items-center mt-2">
        <text class="text-sm mr-2">依赖缓存</text>
        <wd-switch v-model="form.cacheEnabled" />
      </view>
      <template v-if="form.frameworkType === 'ssr'">
        <wd-input v-model="form.ssrEntryPoint" label="SSR 入口" />
        <wd-input v-model="form.previewHealthCheckPath" label="预览健康路径" />
      </template>
      <view class="flex items-center mt-2">
        <text class="text-sm mr-2">容器镜像构建</text>
        <wd-switch v-model="form.containerImageEnabled" />
      </view>
      <wd-input v-if="form.containerImageEnabled" v-model="form.containerImageName" label="镜像名" />
      <wd-input v-if="form.containerImageEnabled" v-model="form.registryUsername" label="Registry 用户" />
      <wd-input
        v-if="form.containerImageEnabled"
        v-model="form.registryPassword"
        label="Registry 密码"
        placeholder="留空则保留已保存凭据"
        show-password
      />
      <template v-if="showPrPreviewSection">
        <view class="h-px bg-gray-200 my-3" />
        <text class="text-sm text-gray-600">PR 预览（GitHub）</text>
        <view class="flex items-center mt-2">
          <text class="text-sm mr-2">启用</text>
          <wd-switch v-model="form.previewEnabled" />
        </view>
        <template v-if="form.previewEnabled">
          <picker
            v-if="serverPickerRows.length > 0"
            mode="selector"
            :range="serverPickerRows"
            range-key="label"
            :value="previewServerIndex"
            @change="onPreviewServerChange"
          >
            <wd-cell title="预览服务器" :value="previewServerLabel" is-link />
          </picker>
          <wd-cell v-else title="预览服务器" value="暂无可用服务器，请先在组织内添加" />
          <wd-input v-model="form.previewBaseDomain" label="预览父域" placeholder="如 preview.example.com" />
        </template>
      </template>
      <wd-button block type="primary" class="mt-4" :loading="saving" @click="save">保存</wd-button>
      <wd-button block plain class="mt-2" @click="onUpdateShow(false)">取消</wd-button>
    </scroll-view>
  </wd-popup>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { URL_SLUG_VALIDATION_MESSAGE, isValidUrlSlug } from '@shipyard/shared';
import * as projectsApi from '@/api/projects';
import type { ProjectDetail, UpdatePipelineConfigPayload } from '@/api/projects';
import { listServers } from '@/package-org/api/servers';

const props = defineProps<{
  modelValue: boolean;
  orgSlug: string;
  projectSlug: string;
  project: ProjectDetail | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  saved: [{ slugChanged: boolean; newSlug: string }];
}>();

const saving = ref(false);

const frameworkOptions = [
  { label: '静态站点', value: 'static' as const },
  { label: 'SSR（服务端渲染）', value: 'ssr' as const },
];

const nodeVersionOptions = ['18', '20', '22'].map((v) => ({ label: `Node ${v}`, value: v }));

const form = ref({
  name: '',
  slug: '',
  frameworkType: 'static' as 'static' | 'ssr',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  outputDir: 'dist',
  nodeVersion: '20',
  lintCommand: '',
  testCommand: '',
  timeoutSeconds: 900,
  cacheEnabled: true,
  ssrEntryPoint: 'dist/index.js',
  previewHealthCheckPath: '',
  previewEnabled: false,
  previewServerId: '',
  previewBaseDomain: '',
  containerImageEnabled: false,
  containerImageName: '',
  registryUsername: '',
  registryPassword: '',
});

const serverOptions = ref<Awaited<ReturnType<typeof listServers>>>([]);

const showPrPreviewSection = computed(
  () => props.project?.gitConnection?.gitProvider === 'github',
);

const serverPickerRows = computed(() =>
  serverOptions.value.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.host})`,
  })),
);

const frameworkIndex = computed(() => {
  const i = frameworkOptions.findIndex((o) => o.value === form.value.frameworkType);
  return i >= 0 ? i : 0;
});

const nodeVersionIndex = computed(() => {
  const i = nodeVersionOptions.findIndex((o) => o.value === form.value.nodeVersion);
  return i >= 0 ? i : 0;
});

const previewServerIndex = computed(() => {
  const id = form.value.previewServerId;
  if (!id) return 0;
  const i = serverPickerRows.value.findIndex((r) => r.id === id);
  return i >= 0 ? i : 0;
});

const previewServerLabel = computed(() => {
  const row = serverPickerRows.value[previewServerIndex.value];
  return row?.label ?? '请选择';
});

function onUpdateShow(v: boolean) {
  emit('update:modelValue', v);
}

function onFrameworkChange(ev: { detail: { value: number } }) {
  const idx = Number(ev.detail.value);
  const opt = frameworkOptions[idx];
  if (opt) form.value.frameworkType = opt.value;
}

function onNodeVersionChange(ev: { detail: { value: number } }) {
  const idx = Number(ev.detail.value);
  const opt = nodeVersionOptions[idx];
  if (opt) form.value.nodeVersion = opt.value;
}

function onPreviewServerChange(ev: { detail: { value: number } }) {
  const idx = Number(ev.detail.value);
  const row = serverPickerRows.value[idx];
  form.value.previewServerId = row?.id ?? '';
}

function syncFromProject(p: ProjectDetail) {
  const pc = p.pipelineConfig;
  const ft = p.frameworkType === 'ssr' ? 'ssr' : 'static';
  form.value = {
    name: p.name,
    slug: p.slug,
    frameworkType: ft,
    installCommand: pc?.installCommand ?? 'pnpm install',
    buildCommand: pc?.buildCommand ?? 'pnpm build',
    outputDir: pc?.outputDir ?? 'dist',
    nodeVersion: pc?.nodeVersion ?? '20',
    lintCommand: pc?.lintCommand ?? '',
    testCommand: pc?.testCommand ?? '',
    timeoutSeconds: pc?.timeoutSeconds ?? 900,
    cacheEnabled: pc?.cacheEnabled ?? true,
    ssrEntryPoint: pc?.ssrEntryPoint ?? 'dist/index.js',
    previewHealthCheckPath: pc?.previewHealthCheckPath ?? '',
    previewEnabled: p.previewEnabled ?? false,
    previewServerId: p.previewServerId ?? '',
    previewBaseDomain: p.previewBaseDomain ?? '',
    containerImageEnabled: pc?.containerImageEnabled ?? false,
    containerImageName: pc?.containerImageName ?? '',
    registryUsername: '',
    registryPassword: '',
  };
}

async function loadServers() {
  if (!props.orgSlug) {
    serverOptions.value = [];
    return;
  }
  try {
    serverOptions.value = await listServers(props.orgSlug);
  } catch {
    serverOptions.value = [];
  }
}

watch(
  () => [props.modelValue, props.project] as const,
  async ([open, p]) => {
    if (open && p) {
      syncFromProject(p);
      await loadServers();
    }
  },
);

async function save() {
  const v = form.value;
  if (!v.name.trim() || !v.slug.trim()) {
    uni.showToast({ title: '请填写项目名称与 URL 标识', icon: 'none' });
    return;
  }
  if (!isValidUrlSlug(v.slug.trim())) {
    uni.showToast({ title: URL_SLUG_VALIDATION_MESSAGE, icon: 'none' });
    return;
  }
  if (!v.installCommand.trim() || !v.buildCommand.trim() || !v.outputDir.trim()) {
    uni.showToast({ title: '请填写安装命令、构建命令与输出目录', icon: 'none' });
    return;
  }
  const ts = Number(v.timeoutSeconds);
  if (!Number.isFinite(ts) || ts < 60) {
    uni.showToast({ title: '构建超时至少 60 秒', icon: 'none' });
    return;
  }
  if (showPrPreviewSection.value && v.previewEnabled) {
    if (!v.previewServerId.trim()) {
      uni.showToast({ title: '启用 PR 预览时请选择一个预览服务器', icon: 'none' });
      return;
    }
    if (!v.previewBaseDomain.trim()) {
      uni.showToast({ title: '请填写预览父域（如 preview.example.com）', icon: 'none' });
      return;
    }
  }

  const slugBefore = props.projectSlug;
  saving.value = true;
  try {
    await projectsApi.updateProject(props.orgSlug, slugBefore, {
      name: v.name.trim(),
      slug: v.slug.trim(),
      frameworkType: v.frameworkType,
      previewEnabled: v.previewEnabled,
      previewServerId: v.previewEnabled ? v.previewServerId.trim() : null,
      previewBaseDomain: v.previewEnabled ? v.previewBaseDomain.trim() : null,
    });
    const slugAfter = v.slug.trim();

    if (props.project?.pipelineConfig) {
      const body: UpdatePipelineConfigPayload = {
        installCommand: v.installCommand.trim(),
        buildCommand: v.buildCommand.trim(),
        outputDir: v.outputDir.trim(),
        nodeVersion: v.nodeVersion.trim(),
        cacheEnabled: v.cacheEnabled,
        timeoutSeconds: ts,
        lintCommand: v.lintCommand.trim() ? v.lintCommand.trim() : null,
        testCommand: v.testCommand.trim() ? v.testCommand.trim() : null,
        ssrEntryPoint: v.frameworkType === 'ssr' ? v.ssrEntryPoint.trim() || null : null,
        previewHealthCheckPath:
          v.frameworkType === 'ssr' && v.previewHealthCheckPath.trim()
            ? v.previewHealthCheckPath.trim()
            : null,
        containerImageEnabled: v.containerImageEnabled,
        containerImageName: v.containerImageEnabled ? v.containerImageName.trim() || null : null,
      };
      if (v.registryPassword.trim()) {
        body.containerRegistryAuth = {
          username: v.registryUsername.trim() || undefined,
          password: v.registryPassword.trim(),
        };
      }
      await projectsApi.updatePipelineConfig(props.orgSlug, slugAfter, body);
    }

    uni.showToast({ title: '已保存', icon: 'success' });
    emit('update:modelValue', false);
    emit('saved', { slugChanged: slugAfter !== slugBefore, newSlug: slugAfter });
  } catch {
    // 全局 request 已提示
  } finally {
    saving.value = false;
  }
}
</script>
