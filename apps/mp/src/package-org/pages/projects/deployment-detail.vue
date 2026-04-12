<template>
  <view class="p-3">
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
        <text v-for="line in logLines" :key="line.seq" class="log-line">{{ line.content }}</text>
        <view v-if="!logLines.length" class="text-gray-500 text-sm">暂无日志</view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useProjectPageContext } from '@/composables/useProjectPageContext';
import * as pipelineApi from '@/api/pipeline';
import type { DeploymentDetail, DeploymentLogLine } from '@/api/pipeline';
import * as projectsApi from '@/api/projects';
import { HttpError } from '@/api/http';

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
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '加载失败', icon: 'none' });
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
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '重试失败', icon: 'none' });
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
</style>
