<template>
  <page-meta
    :background-text-style="pageMetaBgText"
    :background-color="pageMetaBg"
    :background-color-top="pageMetaBg"
    :root-background-color="pageMetaBg"
    :background-color-bottom="pageMetaBg"
  />
  <mp-theme-provider>
  <mp-custom-nav-bar />
  <view class="p-3 mp-tab-page--with-bottom-bar mp-page-column-fill">
    <OrgNavGrid v-if="orgSlug" scope="deployment" :org-slug="orgSlug" />
    <view class="flex justify-end mb-2">
      <wd-button size="small" type="primary" @click="goNew">新建项目</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <wd-cell-group v-else-if="projects.length" border>
      <wd-cell
        v-for="p in projects"
        :key="p.id"
        :title="p.name"
        :label="`${p.slug} · ${p.repoFullName}`"
        is-link
        @click="goDetail(p.slug)"
      />
    </wd-cell-group>
    <view v-else class="mp-page-column-fill__grow">
      <mp-page-empty variant="page" title="暂无项目" />
    </view>
  </view>
  <mp-main-tab-bar :tab-index="1" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, watch } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useOrgTabEntryPage } from '@/composables/useOrgTabEntryPage';
import * as projectsApi from '@/api/projects';
import type { ProjectListItem } from '@/api/projects';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();
const { t } = useI18n();
const { orgSlug, onShowEntry, onLoadEntry } = useOrgTabEntryPage(t);
const loading = ref(false);
const projects = ref<ProjectListItem[]>([]);

onShow(onShowEntry);
onLoad((q) => onLoadEntry(q as Record<string, string | undefined>));

watch(
  orgSlug,
  async (s) => {
    if (!s) return;
    loading.value = true;
    try {
      projects.value = await projectsApi.listProjects(s);
    } catch {
      // 全局 request 已提示
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
