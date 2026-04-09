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
            <div style="margin-top: 12px; font-size: 12px; color: var(--n-text-color-3)">
              {{ p.environments.length }} 个环境 · {{ p._count.deployments }} 次部署
            </div>
          </n-card>
        </n-grid-item>
      </n-grid>
      <n-empty v-if="!loading && projects.length === 0" description="暂无项目" style="margin-top: 40px" />
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NPageHeader, NGrid, NGridItem, NCard, NText, NTag, NSpin, NEmpty, NButton } from 'naive-ui';
import { listProjects, type ProjectListItem } from './api';

const route = useRoute();
const router = useRouter();
const orgSlug = route.params['orgSlug'] as string;
const loading = ref(false);
const projects = ref<ProjectListItem[]>([]);

onMounted(async () => {
  loading.value = true;
  try {
    projects.value = await listProjects(orgSlug);
  } finally {
    loading.value = false;
  }
});
</script>
