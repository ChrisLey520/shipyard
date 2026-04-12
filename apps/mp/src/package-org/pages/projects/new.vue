<template>
  <view class="p-3">
    <wd-input v-model="form.name" label="名称" placeholder="项目名称" />
    <wd-input v-model="form.slug" label="Slug" placeholder="url 友好标识" />
    <wd-input v-model="form.gitAccountId" label="Git 账户 ID" placeholder="组织内 Git 账户 id" />
    <wd-input v-model="form.repoFullName" label="仓库" placeholder="owner/repo" />
    <wd-input v-model="form.frameworkType" label="框架" placeholder="如 static、nextjs" />
    <wd-input v-model="form.installCommand" label="安装命令" />
    <wd-input v-model="form.buildCommand" label="构建命令" />
    <wd-input v-model="form.outputDir" label="产物目录" />
    <wd-input v-model="form.nodeVersion" label="Node 版本" placeholder="18 / 20 / 22" />
    <wd-button block type="primary" class="mt-4" :loading="submitting" @click="submit">创建</wd-button>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as projectsApi from '@/api/projects';
import { slugifyFromDisplayName } from '@shipyard/shared';

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const submitting = ref(false);
const form = ref({
  name: '',
  slug: '',
  gitAccountId: '',
  repoFullName: '',
  frameworkType: 'static',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  outputDir: 'dist',
  nodeVersion: '20',
});

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

watch(
  () => form.value.name,
  (n) => {
    form.value.slug = slugifyFromDisplayName(n);
  },
);

async function submit() {
  const f = form.value;
  if (!f.name.trim() || !f.slug.trim() || !f.repoFullName.trim() || !f.gitAccountId.trim()) {
    uni.showToast({ title: '请填写名称、Slug、Git 账户 ID 与仓库', icon: 'none' });
    return;
  }
  const payload: Record<string, unknown> = {
    name: f.name.trim(),
    slug: f.slug.trim(),
    repoFullName: f.repoFullName.trim(),
    gitAccountId: f.gitAccountId.trim(),
    frameworkType: f.frameworkType.trim() || 'static',
    installCommand: f.installCommand.trim() || 'pnpm install',
    buildCommand: f.buildCommand.trim() || 'pnpm build',
    outputDir: f.outputDir.trim() || 'dist',
    nodeVersion: f.nodeVersion.trim() || '20',
  };

  submitting.value = true;
  try {
    await projectsApi.createProject(orgSlug.value, payload);
    uni.showToast({ title: '已创建', icon: 'success' });
    setTimeout(() => {
      uni.navigateBack();
    }, 400);
  } catch {
    // 全局 request 已提示
  } finally {
    submitting.value = false;
  }
}
</script>
