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
  <view class="p-3 mp-tab-page--with-bottom-bar">
    <wd-loading v-if="loading && !detail" />
    <view v-else-if="detail">
      <wd-cell-group title="部署" border>
        <wd-cell title="分支" :value="detail.branch" />
        <wd-cell title="状态" :value="detail.status" />
        <wd-cell title="触发" :value="detail.trigger" />
        <wd-cell title="说明" :label="detail.commitMessage" />
        <wd-cell
          v-if="detail.environment"
          title="环境"
          :value="detail.environment.name"
        />
      </wd-cell-group>

      <view class="flex justify-between items-center mt-4 mb-2">
        <text class="text-sm font-medium">日志（轮询刷新）</text>
        <wd-button v-if="showRetry" size="small" plain :loading="retrying" @click="retry">
          重试
        </wd-button>
      </view>
      <scroll-view scroll-y class="log-box">
        <template v-if="logLines.length">
          <text v-for="line in logLines" :key="line.seq" class="log-line">{{ line.content }}</text>
        </template>
        <view v-else class="log-box-empty">
          <mp-page-empty variant="embed" dense title="暂无日志" />
        </view>
      </scroll-view>
    </view>
  </view>
  <mp-main-tab-bar :tab-index="1" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, watch, computed, onUnmounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useProjectPageContext } from '@/package-org/composables/useProjectPageContext';
import * as pipelineApi from '@/package-org/api/pipeline';
import type { DeploymentDetail, DeploymentLogLine } from '@/package-org/api/pipeline';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import * as projectsApi from '@/api/projects';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();
const { orgSlug, projectSlug, initProjectFromQuery } = useProjectPageContext();
const deploymentId = ref('');
const loading = ref(true);
const detail = ref<DeploymentDetail | null>(null);
const logLines = ref<DeploymentLogLine[]>([]);
const retrying = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const terminalStatuses = new Set(['success', 'failed', 'cancelled', 'skipped']);

const showRetry = computed(() => detail.value?.status === 'failed');

onLoad((q) => {
  const query = q as Record<string, string | undefined>;
  initProjectFromQuery(query);
  const id = query.deploymentId?.trim();
  if (!id) {
    uni.showToast({ title: '缺少部署 ID', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 500);
    return;
  }
  deploymentId.value = id;
});

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchDetail() {
  if (!orgSlug.value || !projectSlug.value || !deploymentId.value) return;
  try {
    detail.value = await pipelineApi.getDeploymentDetail(
      orgSlug.value,
      projectSlug.value,
      deploymentId.value,
    );
  } catch {
    /* 详情为 silent 请求，失败时保留/清空由轮询与首屏处理 */
  }
}

async function fetchLogs() {
  if (!orgSlug.value || !projectSlug.value || !deploymentId.value) return;
  try {
    logLines.value = await pipelineApi.getDeploymentLogs(
      orgSlug.value,
      projectSlug.value,
      deploymentId.value,
    );
  } catch {
    /* 日志接口失败时保留旧内容 */
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(async () => {
    await fetchDetail();
    await fetchLogs();
    const st = detail.value?.status;
    if (st && terminalStatuses.has(st)) {
      stopPoll();
    }
  }, 2500);
}

watch(
  [orgSlug, projectSlug, deploymentId],
  async () => {
    if (!orgSlug.value || !projectSlug.value || !deploymentId.value) return;
    loading.value = true;
    stopPoll();
    try {
      await fetchDetail();
      await fetchLogs();
      const st = detail.value?.status;
      if (!st || !terminalStatuses.has(st)) {
        startPoll();
      }
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  stopPoll();
});

async function retry() {
  retrying.value = true;
  try {
    await projectsApi.retryDeployment(orgSlug.value, projectSlug.value, deploymentId.value);
    uni.showToast({ title: '已重试', icon: 'success' });
    loading.value = true;
    await fetchDetail();
    await fetchLogs();
    startPoll();
  } catch {
    // 全局 request 已提示
  } finally {
    retrying.value = false;
    loading.value = false;
  }
}
</script>

<style scoped>
.log-box {
  max-height: 55vh;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 8px;
}
.log-line {
  display: block;
  font-size: 22rpx;
  color: #d4d4d4;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 4rpx;
}

.log-box-empty {
  min-height: 360rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 0;
}
</style>
