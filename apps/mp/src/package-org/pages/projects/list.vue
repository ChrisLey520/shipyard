<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <view class="flex justify-end mb-2">
      <wd-button size="small" type="primary" @click="goNew">新建项目</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <wd-cell-group v-else border>
      <wd-cell
        v-for="p in projects"
        :key="p.id"
        :title="p.name"
        :label="`${p.slug} · ${p.repoFullName}`"
        is-link
        @click="goDetail(p.slug)"
      />
    </wd-cell-group>
    <view v-if="!loading && !projects.length" class="text-center text-gray-500 py-8">暂无项目</view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as projectsApi from '@/api/projects';
import type { ProjectListItem } from '@/api/projects';
import { HttpError } from '@/api/http';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const loading = ref(false);
const projects = ref<ProjectListItem[]>([]);

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

watch(
  orgSlug,
  async (s) => {
    if (!s) return;
    loading.value = true;
    try {
      projects.value = await projectsApi.listProjects(s);
    } catch (e) {
      uni.showToast({ title: e instanceof HttpError ? e.message : '加载失败', icon: 'none' });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function goNew() {
  uni.navigateTo({
    url: `/package-org/pages/projects/new?orgSlug=${encodeURIComponent(orgSlug.value)}`,
  });
}

function goDetail(slug: string) {
  uni.navigateTo({
    url: `/package-org/pages/projects/detail?orgSlug=${encodeURIComponent(orgSlug.value)}&projectSlug=${encodeURIComponent(slug)}`,
  });
}
</script>
