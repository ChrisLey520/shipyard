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
      <wd-input v-model="form.frameworkType" label="框架" placeholder="static / ssr" />
      <view class="h-px bg-gray-200 my-3" />
      <text class="text-sm text-gray-600">构建配置</text>
      <wd-input v-model="form.installCommand" label="安装命令" />
      <wd-input v-model="form.buildCommand" label="构建命令" />
      <wd-input v-model="form.outputDir" label="输出目录" />
      <wd-input v-model="form.nodeVersion" label="Node 版本" />
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
      <wd-input v-if="form.containerImageEnabled" v-model="form.registryPassword" label="Registry 密码" show-password />
      <view class="h-px bg-gray-200 my-3" />
      <text class="text-sm text-gray-600">PR 预览</text>
      <view class="flex items-center mt-2">
        <text class="text-sm mr-2">启用</text>
        <wd-switch v-model="form.previewEnabled" />
      </view>
      <wd-input v-if="form.previewEnabled" v-model="form.previewServerId" label="预览服务器 ID" />
      <wd-input v-if="form.previewEnabled" v-model="form.previewBaseDomain" label="预览父域" />
      <wd-button block type="primary" class="mt-4" :loading="saving" @click="save">保存</wd-button>
      <wd-button block plain class="mt-2" @click="onUpdateShow(false)">取消</wd-button>
    </scroll-view>
  </wd-popup>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { URL_SLUG_VALIDATION_MESSAGE, isValidUrlSlug } from '@shipyard/shared';
import * as projectsApi from '@/api/projects';
import type { ProjectDetail } from '@/api/projects';
import { HttpError } from '@/api/http';

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

const form = ref({
  name: '',
  slug: '',
  frameworkType: 'static',
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

function onUpdateShow(v: boolean) {
  emit('update:modelValue', v);
}

function syncFromProject(p: ProjectDetail) {
  const pc = p.pipelineConfig;
  form.value = {
    name: p.name,
    slug: p.slug,
    frameworkType: p.frameworkType,
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

watch(
  () => [props.modelValue, props.project] as const,
  ([open, p]) => {
    if (open && p) syncFromProject(p);
  },
);

async function save() {
  const v = form.value;
  if (!v.name.trim() || !v.slug.trim()) {
    uni.showToast({ title: '请填写名称与 Slug', icon: 'none' });
    return;
  }
  if (!isValidUrlSlug(v.slug.trim())) {
    uni.showToast({ title: URL_SLUG_VALIDATION_MESSAGE, icon: 'none' });
    return;
  }
  const ts = Number(v.timeoutSeconds);
  if (!Number.isFinite(ts) || ts < 60) {
    uni.showToast({ title: '构建超时至少 60 秒', icon: 'none' });
    return;
  }
  if (v.previewEnabled) {
    if (!v.previewServerId.trim()) {
      uni.showToast({ title: '请填写预览服务器 ID', icon: 'none' });
      return;
    }
    if (!v.previewBaseDomain.trim()) {
      uni.showToast({ title: '请填写预览父域', icon: 'none' });
      return;
    }
  }

  const slugBefore = props.projectSlug;
  saving.value = true;
  try {
    await projectsApi.updateProject(props.orgSlug, slugBefore, {
      name: v.name.trim(),
      slug: v.slug.trim(),
      frameworkType: v.frameworkType.trim(),
      previewEnabled: v.previewEnabled,
      previewServerId: v.previewEnabled ? v.previewServerId.trim() : null,
      previewBaseDomain: v.previewEnabled ? v.previewBaseDomain.trim() : null,
    });
    const slugAfter = v.slug.trim();

    await projectsApi.updatePipelineConfig(props.orgSlug, slugAfter, {
      installCommand: v.installCommand.trim(),
      buildCommand: v.buildCommand.trim(),
      outputDir: v.outputDir.trim(),
      nodeVersion: v.nodeVersion.trim(),
      cacheEnabled: v.cacheEnabled,
      timeoutSeconds: ts,
      lintCommand: v.lintCommand.trim() || null,
      testCommand: v.testCommand.trim() || null,
      ssrEntryPoint: v.frameworkType === 'ssr' ? v.ssrEntryPoint.trim() || null : null,
      previewHealthCheckPath:
        v.frameworkType === 'ssr' && v.previewHealthCheckPath.trim()
          ? v.previewHealthCheckPath.trim()
          : null,
      containerImageEnabled: v.containerImageEnabled,
      containerImageName: v.containerImageEnabled ? v.containerImageName.trim() || null : null,
      containerRegistryAuth:
        v.containerImageEnabled && (v.registryUsername.trim() || v.registryPassword.trim())
          ? {
              username: v.registryUsername.trim() || undefined,
              password: v.registryPassword.trim() || undefined,
            }
          : null,
    });

    uni.showToast({ title: '已保存', icon: 'success' });
    emit('update:modelValue', false);
    emit('saved', { slugChanged: slugAfter !== slugBefore, newSlug: slugAfter });
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>
