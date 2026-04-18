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
  <view
    class="p-3 mp-tab-page--with-bottom-bar mp-page-column-fill"
    :class="{ 'dash-page--dark': isDark }"
    :style="dashDarkThemeStyle"
  >
    <!-- 等待解析组织（含异步拉列表选首个） -->
    <view v-if="!orgSlug" class="dash-org-resolving mp-page-column-fill__grow">
      <wd-loading />
      <text class="dash-org-resolving-text">{{ t('dashboard.loadingOrg') }}</text>
    </view>

    <template v-else>
      <view v-if="isError" class="mp-page-column-fill__grow">
        <mp-page-empty variant="page" :title="t('dashboard.loadFailed')">
          <template #footer>
            <wd-button size="small" type="primary" @click="refetch">{{ t('common.retry') }}</wd-button>
          </template>
        </mp-page-empty>
      </view>

      <!-- 与 Web Dashboard 对齐：有区块结构；无数据时展示 0 / 空文案 -->
      <view v-else class="dash-root mp-page-column-fill__grow">
        <view v-if="showQueryRefreshing" class="dash-refresh-hint">
          <wd-loading size="20px" />
          <text class="dash-refresh-text">{{ t('dashboard.refreshing') }}</text>
        </view>

        <view class="text-xs dash-text-secondary mb-2">{{ t('dashboard.overview') }}</view>
        <view class="dash-stats-grid">
          <view class="dash-stat-card">
            <text class="dash-stat-label">{{ t('dashboard.deploysThisMonth') }}</text>
            <text class="dash-stat-value">{{ stats.totalDeploys }}</text>
          </view>
          <view class="dash-stat-card">
            <text class="dash-stat-label">{{ t('dashboard.successRate') }}</text>
            <text class="dash-stat-value">{{ stats.successRate }}%</text>
          </view>
          <view class="dash-stat-card">
            <text class="dash-stat-label">{{ t('dashboard.avgBuildDuration') }}</text>
            <text class="dash-stat-value dash-stat-value--sm">{{ stats.avgDuration }}</text>
          </view>
          <view class="dash-stat-card">
            <text class="dash-stat-label">{{ t('dashboard.activeProjects') }}</text>
            <text class="dash-stat-value">{{ stats.activeProjects }}</text>
          </view>
        </view>

        <wd-cell-group :title="t('dashboard.buildsLast7Days')" border custom-class="dash-section">
          <view class="dash-chart-wrap">
            <view class="flex items-end justify-between h-32 px-1 pt-2 pb-1">
              <view
                v-for="(h, i) in barHeights"
                :key="i"
                class="flex flex-col items-center flex-1 mx-0.5"
              >
                <view
                  class="w-full rounded-t max-h-28 bar-fill"
                  :style="{ height: h + 'px', minHeight: h > 0 ? '4px' : '0' }"
                />
                <text class="text-xs dash-text-secondary mt-1">{{ last7DaysLabels[i] }}</text>
              </view>
            </view>
            <mp-page-empty
              v-if="!last7DaysBuildCounts.some((c) => c > 0)"
              variant="embed"
              dense
              class="dash-chart-empty"
            >
              <text class="text-xs dash-text-tertiary text-center w-full block">
                {{ t('dashboard.noBuildsLast7Days') }}
              </text>
            </mp-page-empty>
          </view>
        </wd-cell-group>

        <wd-cell-group :title="t('dashboard.recentDeployments')" border custom-class="dash-section">
          <template v-if="recentDeployments.length">
            <wd-cell
              v-for="d in recentDeployments"
              :key="d.id"
              :title="d.branch"
              :label="`${d.status} · ${d.commitMessage ?? ''}`"
              is-link
              @click="openDeployment(d)"
            />
          </template>
          <mp-page-empty
            v-else
            variant="embed"
            :title="t('dashboard.noDeployments')"
            :description="t('dashboard.noDeploymentsHint')"
          >
            <template #footer>
              <wd-button size="small" type="primary" @click="goProjects">
                {{ t('dashboard.goProjects') }}
              </wd-button>
            </template>
          </mp-page-empty>
        </wd-cell-group>
      </view>
    </template>
  </view>
  <mp-main-tab-bar :tab-index="0" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/theme';
import { darkCardBackground } from '@/theme/darkPalette';
import { tabBarSelectedHex } from '@/theme/wotVars';
import { useOrgStore } from '@/stores/org';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import { useOrgTabEntryPage } from '@/composables/useOrgTabEntryPage';
import { useOrgDashboardQueries } from '@/composables/useOrgDashboardQueries';
import type { DashboardDeploymentRow } from '@/composables/useOrgDashboardQueries';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();
const { t } = useI18n();
const { isDark, themeId } = storeToRefs(useThemeStore());

const dashDarkThemeStyle = computed(() => {
  if (!isDark.value) return {};
  return {
    '--dash-card-bg': darkCardBackground[themeId.value],
    '--dash-bar-fill': tabBarSelectedHex(themeId.value, true),
  } as Record<string, string>;
});
const orgStore = useOrgStore();
const { orgSlug, onShowEntry, onLoadEntry } = useOrgTabEntryPage(t);
const { data, isFetching, isError, refetch } = useOrgDashboardQueries(orgSlug);

/** 与 buildDashboardModel 无数据时一致 */
const emptyStats = {
  totalDeploys: 0,
  successRate: 100,
  avgDuration: '—',
  activeProjects: 0,
};

function defaultLast7DayLabels(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
}

const stats = computed(() => data.value?.stats ?? emptyStats);

const last7DaysLabels = computed(() => {
  const labels = data.value?.last7DaysLabels;
  return labels?.length === 7 ? labels : defaultLast7DayLabels();
});

const last7DaysBuildCounts = computed(() => {
  const c = data.value?.last7DaysBuildCounts;
  return c?.length === 7 ? c : Array<number>(7).fill(0);
});

const recentDeployments = computed(() => data.value?.recentDeployments ?? []);

const barHeights = computed(() => {
  const m = last7DaysBuildCounts.value;
  const max = Math.max(1, ...m);
  const maxPx = 100;
  return m.map((c) => Math.round((c / max) * maxPx));
});

/** 首次拉取尚无缓存时给轻量提示，仍展示静态骨架 */
const showQueryRefreshing = computed(
  () => Boolean(orgSlug.value) && isFetching.value && data.value === undefined,
);

onShow(onShowEntry);

onLoad((q) => onLoadEntry(q as Record<string, string | undefined>));

function goProjects() {
  orgStore.setCurrentOrg(orgSlug.value);
  uni.switchTab({ url: '/pages/deployment/index' });
}

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
/* 与 Web 端 Dashboard 柱状图主色对齐（Naive / ECharts #18a058） */
.bar-fill {
  background-color: #18a058;
}

.dash-org-resolving {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 32rpx;
  gap: 24rpx;
}

.dash-org-resolving-text {
  font-size: 26rpx;
  color: #64748b;
}

.dash-root {
  padding-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dash-refresh-hint {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
  padding: 12rpx 16rpx;
  background: #f1f5f9;
  border-radius: 12rpx;
}

.dash-refresh-text {
  font-size: 24rpx;
  color: #64748b;
}

.dash-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.dash-stat-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 20rpx;
  border: 1rpx solid #e2e8f0;
}

.dash-stat-label {
  display: block;
  font-size: 22rpx;
  color: #64748b;
  margin-bottom: 8rpx;
}

.dash-stat-value {
  font-size: 36rpx;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.2;
}

.dash-stat-value--sm {
  font-size: 30rpx;
}

:deep(.dash-section) {
  margin-top: 16rpx;
}

.dash-chart-wrap {
  background: #fff;
}

.dash-chart-empty {
  margin-top: -8rpx;
}

.dash-text-secondary {
  color: #64748b;
}

.dash-text-tertiary {
  color: #94a3b8;
}

/* 深色：统计卡、图表区、提示条与 Web 深色卡片语义对齐 */
.dash-page--dark .dash-org-resolving-text {
  color: #94a3b8;
}

.dash-page--dark .dash-refresh-hint {
  background: rgba(255, 255, 255, 0.06);
}

.dash-page--dark .dash-refresh-text {
  color: #94a3b8;
}

.dash-page--dark .dash-text-secondary {
  color: #94a3b8;
}

.dash-page--dark .dash-text-tertiary {
  color: #64748b;
}

.dash-page--dark .dash-stat-card {
  background: var(--dash-card-bg);
  border-color: rgba(148, 163, 184, 0.2);
}

.dash-page--dark .dash-stat-label {
  color: #94a3b8;
}

.dash-page--dark .dash-stat-value {
  color: #f1f5f9;
}

.dash-page--dark .dash-chart-wrap {
  background: var(--dash-card-bg);
}

.dash-page--dark .bar-fill {
  background-color: var(--dash-bar-fill);
}
</style>
