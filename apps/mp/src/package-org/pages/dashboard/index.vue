<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <wd-loading v-if="isLoading" />
    <view v-else-if="data">
      <view class="text-sm text-gray-600 mb-2">近 7 日部署次数</view>
      <view class="flex items-end justify-between h-32 px-1 mb-4">
        <view
          v-for="(h, i) in barHeights"
          :key="i"
          class="flex flex-col items-center flex-1 mx-0.5"
        >
          <view
            class="w-full rounded-t max-h-28 bar-fill"
            :style="{ height: h + 'px', minHeight: h > 0 ? '4px' : '0' }"
          />
          <text class="text-xs text-gray-500 mt-1">{{ data.last7DaysLabels[i] }}</text>
        </view>
      </view>

      <wd-cell-group title="概览" border>
        <wd-cell title="活跃项目" :value="String(data.stats.activeProjects)" />
        <wd-cell title="部署总数" :value="String(data.stats.totalDeploys)" />
        <wd-cell title="成功率" :value="`${data.stats.successRate}%`" />
        <wd-cell title="平均耗时（成功）" :value="data.stats.avgDuration" />
      </wd-cell-group>

      <view class="text-sm font-medium mt-4 mb-2">最近部署</view>
      <wd-cell-group border>
        <wd-cell
          v-for="d in data.recentDeployments"
          :key="d.id"
          :title="d.branch"
          :label="`${d.status} · ${d.commitMessage ?? ''}`"
          is-link
          @click="openDeployment(d)"
        />
      </wd-cell-group>
      <view v-if="!data.recentDeployments.length" class="text-center text-gray-500 py-4">暂无部署</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import { useOrgDashboardQueries } from '@/composables/useOrgDashboardQueries';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';
import type { DashboardDeploymentRow } from '@/composables/useOrgDashboardQueries';

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const { data, isLoading } = useOrgDashboardQueries(orgSlug);

const barHeights = computed(() => {
  const m = data.value?.last7DaysBuildCounts ?? [];
  const max = Math.max(1, ...m);
  const maxPx = 100;
  return m.map((c) => Math.round((c / max) * maxPx));
});

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

function openDeployment(d: DashboardDeploymentRow) {
  const o = encodeURIComponent(orgSlug.value);
  const p = encodeURIComponent(d.projectSlug);
  const id = encodeURIComponent(d.id);
  uni.navigateTo({
    url: `/package-org/pages/projects/deployment-detail?orgSlug=${o}&projectSlug=${p}&deploymentId=${id}`,
  });
}
</script>

<style scoped>
.bar-fill {
  background-color: #4d80f0;
}
</style>
