<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <wd-loading v-if="loading" />
    <view v-else-if="project">
      <wd-cell-group title="项目" border>
        <wd-cell title="名称" :value="project.name" />
        <wd-cell title="Slug" :value="project.slug" />
        <wd-cell title="仓库" :value="project.repoFullName" />
        <wd-cell title="框架" :value="project.frameworkType" />
      </wd-cell-group>

      <view class="flex justify-between items-center mt-4 mb-2">
        <text class="text-sm font-medium">环境</text>
        <wd-button size="small" plain @click="goEnvs">管理环境</wd-button>
      </view>

      <view class="flex justify-between items-center mt-4 mb-2">
        <text class="text-sm font-medium">部署记录</text>
        <wd-button size="small" type="primary" plain @click="openDeploySheet">触发部署</wd-button>
      </view>
      <wd-cell-group border>
        <wd-cell
          v-for="d in deployments"
          :key="d.id"
          :title="d.branch"
          :label="`${d.status} · ${formatTime(d.createdAt)}`"
          is-link
          @click="openDep(d.id)"
        />
      </wd-cell-group>
      <view v-if="!deployments.length" class="text-center text-gray-500 py-4">暂无部署</view>

      <wd-button block plain custom-class="mt-4" type="error" @click="confirmDelete">删除项目</wd-button>
    </view>

    <wd-action-sheet
      v-model="showDeploy"
      :actions="envActions"
      cancel-text="取消"
      @select="onDeploySheetSelect"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useProjectPageContext } from '@/composables/useProjectPageContext';
import * as projectsApi from '@/api/projects';
import type { ProjectDetail, DeploymentListItem } from '@/api/projects';
import { HttpError } from '@/api/http';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';

const { orgSlug, projectSlug, initProjectFromQuery } = useProjectPageContext();
const loading = ref(true);
const project = ref<ProjectDetail | null>(null);
const deployments = ref<DeploymentListItem[]>([]);
const showDeploy = ref(false);

const envActions = computed(() =>
  (project.value?.environments ?? []).map((e) => ({
    name: `${e.name}（${e.triggerBranch}）`,
    envId: e.id,
  })) as Array<{ name: string; envId: string }>,
);

onLoad((q) => {
  initProjectFromQuery(q as Record<string, string | undefined>);
});

watch(
  [orgSlug, projectSlug],
  async () => {
    if (!orgSlug.value || !projectSlug.value) return;
    loading.value = true;
    try {
      const [p, deps] = await Promise.all([
        projectsApi.getProject(orgSlug.value, projectSlug.value),
        projectsApi.listDeployments(orgSlug.value, projectSlug.value),
      ]);
      project.value = p;
      deployments.value = deps;
    } catch (e) {
      uni.showToast({ title: e instanceof HttpError ? e.message : '加载失败', icon: 'none' });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function goEnvs() {
  uni.navigateTo({
    url: `/package-org/pages/projects/environments?orgSlug=${encodeURIComponent(orgSlug.value)}&projectSlug=${encodeURIComponent(projectSlug.value)}`,
  });
}

function openDep(id: string) {
  uni.navigateTo({
    url: `/package-org/pages/projects/deployment-detail?orgSlug=${encodeURIComponent(orgSlug.value)}&projectSlug=${encodeURIComponent(projectSlug.value)}&deploymentId=${encodeURIComponent(id)}`,
  });
}

function openDeploySheet() {
  if (!envActions.value.length) {
    uni.showToast({ title: '请先创建环境', icon: 'none' });
    return;
  }
  showDeploy.value = true;
}

function onDeploySheetSelect(payload: { item: { name: string; envId?: string } }) {
  const envId = payload.item.envId;
  if (!envId) return;
  void doDeploy(envId);
}

async function doDeploy(environmentId: string) {
  try {
    await projectsApi.triggerDeploy(orgSlug.value, projectSlug.value, { environmentId });
    uni.showToast({ title: '已触发', icon: 'success' });
    deployments.value = await projectsApi.listDeployments(orgSlug.value, projectSlug.value);
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '触发失败', icon: 'none' });
  }
}

function confirmDelete() {
  uni.showModal({
    title: '删除项目',
    content: '确定删除该项目？此操作不可恢复。',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await projectsApi.deleteProject(orgSlug.value, projectSlug.value);
        uni.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 400);
      } catch (e) {
        uni.showToast({ title: e instanceof HttpError ? e.message : '删除失败', icon: 'none' });
      }
    },
  });
}
</script>
