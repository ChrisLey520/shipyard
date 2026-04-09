<template>
  <div>
    <n-page-header :title="`部署 #${deploymentId.slice(0, 8)}`" @back="router.back()">
      <template #extra>
        <n-tag :type="statusMap[deployment?.status ?? ''] ?? 'default'">
          {{ deployment?.status ?? '—' }}
        </n-tag>
      </template>
      <template #subtitle>
        <n-text depth="3">{{ deployment?.branch }} · {{ deployment?.commitMessage }}</n-text>
      </template>
    </n-page-header>

    <n-grid :cols="3" :x-gap="16" style="margin: 16px 0">
      <n-grid-item>
        <n-statistic label="环境">{{ deployment?.environment?.name ?? 'Preview' }}</n-statistic>
      </n-grid-item>
      <n-grid-item>
        <n-statistic label="触发方式">{{ deployment?.trigger }}</n-statistic>
      </n-grid-item>
      <n-grid-item>
        <n-statistic label="耗时">
          {{ deployment?.durationMs ? formatDuration(deployment.durationMs) : '进行中...' }}
        </n-statistic>
      </n-grid-item>
    </n-grid>

    <!-- Xterm.js 日志终端 -->
    <n-card title="构建日志">
      <div ref="terminalEl" style="height: 480px; background: #1e1e1e; border-radius: 4px" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NPageHeader, NGrid, NGridItem, NStatistic, NTag, NText, NCard } from 'naive-ui';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io } from 'socket.io-client';
import { http } from '../../api/client';
import { formatDuration } from '@shipyard/shared';
import { useAuthStore } from '../../stores/auth';

interface Deployment {
  id: string;
  branch: string;
  commitMessage: string;
  status: string;
  trigger: string;
  durationMs: number | null;
  environment?: { name: string };
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const deploymentId = route.params['deploymentId'] as string;
const terminalEl = ref<HTMLElement | null>(null);
const deployment = ref<Deployment | null>(null);

const statusMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  success: 'success', failed: 'error', building: 'warning',
  deploying: 'info', queued: 'default',
};

let terminal: Terminal | null = null;
let socket: ReturnType<typeof io> | null = null;

onMounted(async () => {
  deployment.value = await http.get<Deployment>(`/api/deployments/${deploymentId}`).then((r) => r.data).catch(() => null);

  // 初始化终端
  terminal = new Terminal({ theme: { background: '#1e1e1e' }, fontSize: 13, fontFamily: 'monospace' });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  if (terminalEl.value) {
    terminal.open(terminalEl.value);
    fitAddon.fit();
  }

  // 加载历史日志
  const logs = await http.get<{ content: string; seq: number }[]>(`/api/deployments/${deploymentId}/logs`)
    .then((r) => r.data)
    .catch(() => []);
  const sorted = [...logs].sort((a, b) => a.seq - b.seq);
  for (const log of sorted) {
    terminal.writeln(log.content);
  }

  // 如果仍在构建中，连接 Socket.io 实时推流
  if (['building', 'deploying', 'queued'].includes(deployment.value?.status ?? '')) {
    socket = io({ auth: { token: auth.accessToken } });
    socket.emit('subscribe:logs', { deploymentId });
    socket.on('log:line', (data: { deploymentId: string; line: string }) => {
      if (data.deploymentId === deploymentId) {
        terminal?.writeln(data.line);
      }
    });
  }
});

onUnmounted(() => {
  socket?.disconnect();
  terminal?.dispose();
});
</script>
