<template>
  <div>
    <n-page-header :title="`部署 #${deploymentId.slice(0, 8)}`" @back="router.back()">
      <template #extra>
        <n-space>
          <n-button
            v-if="deployment?.status === 'failed'"
            type="primary"
            size="small"
            secondary
            :loading="retrying"
            @click="handleRetry"
          >
            重试
          </n-button>
          <n-tag :type="statusMap[deployment?.status ?? ''] ?? 'default'">
            {{ t(deploymentStatusKey(deployment?.status)) }}
          </n-tag>
        </n-space>
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
        <n-statistic label="触发方式">{{ t(deploymentTriggerKey(deployment?.trigger)) }}</n-statistic>
      </n-grid-item>
      <n-grid-item>
        <n-statistic label="耗时">
          {{ durationLabel }}
        </n-statistic>
      </n-grid-item>
    </n-grid>

    <n-card title="部署流程" class="mb-4">
      <template #header-extra>
        <n-button size="small" secondary @click="toggleAllFlowGroups">
          {{ allFlowGroupsExpanded ? '全部折叠' : '全部展开' }}
        </n-button>
      </template>

      <n-collapse v-model:expanded-names="expandedFlowGroups">
        <div class="flow2-grid">
          <section class="flow2-group">
            <n-collapse-item name="prep">
              <template #header>
                <div class="flow2-collapse-head">
                  <div class="flow2-group-title">准备阶段</div>
                  <div class="flow2-group-sub">排队与依赖就绪</div>
                </div>
              </template>
              <div class="flow2-list">
                <div
                  v-for="(s, idx) in flowStages.slice(0, 3)"
                  :key="s.key"
                  class="flow2-item"
                  :data-status="s.status"
                >
                  <div class="flow2-left">
                    <div class="flow-node" :data-status="s.status">
                      <div class="flow-node-icon">{{ s.icon }}</div>
                    </div>
                    <div
                      v-if="idx !== 2"
                      class="flow2-connector-vert"
                      :data-status="flowConnectorStatus(idx)"
                    />
                  </div>
                  <div class="flow-card flow2-card">
                    <div class="flow-card-top">
                      <div class="flow-title">{{ s.title }}</div>
                      <n-tag size="small" :type="tagTypeByStepStatus(s.status)" class="flow-tag">
                        {{ labelByStepStatus(s.status) }}
                      </n-tag>
                    </div>
                    <div class="flow-desc">{{ s.desc }}</div>
                  </div>
                </div>
              </div>
            </n-collapse-item>
          </section>

          <section class="flow2-group">
            <n-collapse-item name="build">
              <template #header>
                <div class="flow2-collapse-head">
                  <div class="flow2-group-title">质量与构建</div>
                  <div class="flow2-group-sub">检查与产物生成</div>
                </div>
              </template>
              <div class="flow2-list">
                <div
                  v-for="(s, idx2) in flowStages.slice(3, 6)"
                  :key="s.key"
                  class="flow2-item"
                  :data-status="s.status"
                >
                  <div class="flow2-left">
                    <div class="flow-node" :data-status="s.status">
                      <div class="flow-node-icon">{{ s.icon }}</div>
                    </div>
                    <div
                      v-if="idx2 !== 2"
                      class="flow2-connector-vert"
                      :data-status="flowConnectorStatus(idx2 + 3)"
                    />
                  </div>
                  <div class="flow-card flow2-card">
                    <div class="flow-card-top">
                      <div class="flow-title">{{ s.title }}</div>
                      <n-tag size="small" :type="tagTypeByStepStatus(s.status)" class="flow-tag">
                        {{ labelByStepStatus(s.status) }}
                      </n-tag>
                    </div>
                    <div class="flow-desc">{{ s.desc }}</div>
                  </div>
                </div>
              </div>
            </n-collapse-item>
          </section>

          <section class="flow2-group">
            <n-collapse-item name="release">
              <template #header>
                <div class="flow2-collapse-head">
                  <div class="flow2-group-title">发布与收尾</div>
                  <div class="flow2-group-sub">打包、部署与最终结果</div>
                </div>
              </template>
              <div class="flow2-list">
                <div
                  v-for="(s, idx3) in flowStages.slice(6)"
                  :key="s.key"
                  class="flow2-item"
                  :data-status="s.status"
                >
                  <div class="flow2-left">
                    <div class="flow-node" :data-status="s.status">
                      <div class="flow-node-icon">{{ s.icon }}</div>
                    </div>
                    <div
                      v-if="idx3 !== 2"
                      class="flow2-connector-vert"
                      :data-status="flowConnectorStatus(idx3 + 6)"
                    />
                  </div>
                  <div class="flow-card flow2-card">
                    <div class="flow-card-top">
                      <div class="flow-title">{{ s.title }}</div>
                      <n-tag size="small" :type="tagTypeByStepStatus(s.status)" class="flow-tag">
                        {{ labelByStepStatus(s.status) }}
                      </n-tag>
                    </div>
                    <div class="flow-desc">{{ s.desc }}</div>
                  </div>
                </div>
              </div>
            </n-collapse-item>
          </section>
        </div>
      </n-collapse>
    </n-card>

    <n-card
      v-if="deployment?.status === 'success'"
      title="访问地址"
      style="margin-bottom: 16px"
    >
      <n-space vertical size="medium">
        <div v-if="pm2StaticAccessUrl">
          <n-text depth="3" style="display: block; margin-bottom: 4px">PM2 + Node 静态站点（macOS 无 Nginx 或未生效时）</n-text>
          <n-space align="center" :size="8">
            <n-a :href="pm2StaticAccessUrl" target="_blank" rel="noopener noreferrer">
              {{ pm2StaticAccessUrl }}
            </n-a>
            <n-button size="tiny" @click="copyUrl(pm2StaticAccessUrl)">复制</n-button>
          </n-space>
        </div>
        <div v-else-if="primaryAccessUrl">
          <n-text depth="3" style="display: block; margin-bottom: 4px">站点</n-text>
          <n-space align="center" :size="8">
            <n-a :href="primaryAccessUrl" target="_blank" rel="noopener noreferrer">
              {{ primaryAccessUrl }}
            </n-a>
            <n-button size="tiny" @click="copyUrl(primaryAccessUrl)">复制</n-button>
          </n-space>
        </div>
        <div v-if="secondaryAccessUrl">
          <n-text depth="3" style="display: block; margin-bottom: 4px">健康检查 / 其他 URL</n-text>
          <n-space align="center" :size="8">
            <n-a :href="secondaryAccessUrl" target="_blank" rel="noopener noreferrer">
              {{ secondaryAccessUrl }}
            </n-a>
            <n-button size="tiny" @click="copyUrl(secondaryAccessUrl)">复制</n-button>
          </n-space>
        </div>
        <n-alert
          v-if="deployment?.status === 'success' && showLocalLoopbackHint && !pm2StaticAccessUrl"
          type="warning"
          :bordered="false"
          style="margin-bottom: 0"
        >
          当前为本地回环类域名：请在浏览器访问
          <n-text strong>http://localhost/</n-text>
          或
          <n-text strong>http://127.0.0.1/</n-text>
          （默认
          <n-text strong>80</n-text>
          端口，不是前端开发服务器端口）。若页面仍空白，请检查本机是否已安装并 reload Nginx、主配置是否 include 了站点配置目录。
        </n-alert>
        <n-alert
          v-if="!pm2StaticAccessUrl && !primaryAccessUrl && !secondaryAccessUrl"
          type="info"
          :bordered="false"
        >
          当前环境未配置域名与健康检查 URL。产物目录：
          <n-text code>{{ deployment?.environment?.deployPath ?? '—' }}</n-text>
          <template v-if="deployment?.environment?.server?.host">
            （服务器 {{ deployment.environment.server.host }}）
          </template>
          。可在「环境」设置中补充域名或健康检查地址，下次部署成功后会显示可点击链接。
        </n-alert>
      </n-space>
    </n-card>

    <!-- Xterm.js 日志终端（含部署阶段 [deploy] 行） -->
    <n-card title="构建与部署日志">
      <div ref="terminalEl" style="height: 480px; background: #1e1e1e; border-radius: 4px" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useIntervalFn } from '@vueuse/core';
import {
  NPageHeader,
  NGrid,
  NGridItem,
  NStatistic,
  NTag,
  NText,
  NCard,
  NButton,
  NSpace,
  NA,
  NAlert,
  NCollapse,
  NCollapseItem,
  useMessage,
} from 'naive-ui';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io } from 'socket.io-client';
import {
  formatDuration,
  resolveDeployAccessHost,
  isLoopbackHostLabel,
  deploymentStatusKey,
  deploymentTriggerKey,
} from '@shipyard/shared';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/auth';
import {
  getDeploymentDetail,
  getDeploymentLogs,
  type DeploymentDetail,
  type ShipyardDeployAccessMeta,
} from './api';
import { retryDeployment } from '@/api/projects';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const auth = useAuthStore();
const { t } = useI18n();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const projectSlug = computed(() => route.params['projectSlug'] as string);
const deploymentId = computed(() => route.params['deploymentId'] as string);
const terminalEl = ref<HTMLElement | null>(null);
const deployment = ref<DeploymentDetail | null>(null);
const retrying = ref(false);
const logLines = ref<string[]>([]);

/** 由环境域名推导站点根 URL（与 deploy 日志一致） */
function normalizeSiteUrl(domain: string): string {
  const d = domain.trim();
  const base = d.includes('://') ? d : `http://${d}`;
  return `${base.replace(/\/+$/, '')}/`;
}

type FlowStatus = 'process' | 'finish' | 'error' | 'wait';
type StepStatus = 'process' | 'finish' | 'error' | 'wait';

const FLOW_GROUPS = ['prep', 'build', 'release'] as const;
type FlowGroupName = (typeof FLOW_GROUPS)[number];
const expandedFlowGroups = ref<FlowGroupName[]>([...FLOW_GROUPS]);
const allFlowGroupsExpanded = computed(
  () => FLOW_GROUPS.every((g) => expandedFlowGroups.value.includes(g)),
);

// 记住部署流程的折叠状态（跨刷新）
const flowGroupsStorageKey = computed(
  () => `shipyard:deploy:flowGroups:${orgSlug.value}:${projectSlug.value}`,
);

function readExpandedFlowGroups(): FlowGroupName[] {
  try {
    const raw = localStorage.getItem(flowGroupsStorageKey.value);
    if (!raw) return [...FLOW_GROUPS];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [...FLOW_GROUPS];
    const normalized = arr.filter((x): x is FlowGroupName => FLOW_GROUPS.includes(x));
    return normalized.length ? normalized : [...FLOW_GROUPS];
  } catch {
    return [...FLOW_GROUPS];
  }
}

function persistExpandedFlowGroups(v: FlowGroupName[]) {
  try {
    localStorage.setItem(flowGroupsStorageKey.value, JSON.stringify(v));
  } catch {
    /* 忽略 */
  }
}

function toggleAllFlowGroups() {
  expandedFlowGroups.value = allFlowGroupsExpanded.value ? [] : [...FLOW_GROUPS];
}

function hasLog(prefix: string) {
  return logLines.value.some((l) => l.includes(prefix));
}

const flowInfo = computed(() => {
  const st = deployment.value?.status ?? '';
  const failed = st === 'failed' || hasLog('[error]') || hasLog('[deploy] [error]');

  const seen = {
    clone: hasLog('[clone]'),
    install: hasLog('[install]'),
    lint: hasLog('[lint]'),
    test: hasLog('[test]'),
    build: hasLog('[build]'),
    archive: hasLog('[archive]'),
    deploy: hasLog('[deploy] 开始部署') || hasLog('[deploy] rsync') || st === 'deploying',
    healthStart: hasLog('[deploy] 健康检查 '),
    healthOk: hasLog('[deploy] 健康检查通过'),
    healthBad: hasLog('[deploy] 健康检查未通过'),
    doneBuild: hasLog('[done] 构建成功') || st === 'deploying' || st === 'success' || st === 'failed',
    doneDeploy: hasLog('[deploy] 部署成功') || st === 'success',
  };

  const currentIdx = (() => {
    if (st === 'success' || seen.doneDeploy) return 8;
    if (seen.deploy) return 7;
    if (seen.archive) return 6;
    if (seen.build) return 5;
    if (seen.test) return 4;
    if (seen.lint) return 3;
    if (seen.install) return 2;
    if (seen.clone) return 1;
    return 0;
  })();

  const status: FlowStatus = failed ? 'error' : st === 'success' ? 'finish' : 'process';

  const skippedLint = !seen.lint && currentIdx >= 5;
  const skippedTest = !seen.test && currentIdx >= 5;

  const stepStatuses: StepStatus[] = Array.from({ length: 9 }, (_, i) => {
    if (st === 'success' || seen.doneDeploy) return 'finish';
    if (failed) {
      if (i < currentIdx) return 'finish';
      if (i === currentIdx) return 'error';
      return 'wait';
    }
    if (i < currentIdx) return 'finish';
    if (i === currentIdx) return 'process';
    return 'wait';
  });

  // 可选阶段：若已进入后续阶段但没出现对应日志，则标记为“已跳过”
  if (skippedLint) stepStatuses[3] = 'finish';
  if (skippedTest) stepStatuses[4] = 'finish';

  // 完成节点：失败/进行中时不应显示为“进行中”
  if (failed) stepStatuses[8] = 'wait';
  else if (!(st === 'success' || seen.doneDeploy)) stepStatuses[8] = 'wait';

  const stepDescByStatus = (i: number, base: string) => {
    const ss = stepStatuses[i];
    if (ss === 'finish') return base;
    if (ss === 'process') return '进行中';
    if (ss === 'error') return '失败';
    // 失败后后续步骤应显示“已终止”，而不是“未开始/失败”
    if (failed && i > currentIdx) return '已终止';
    return '未开始';
  };

  const desc = {
    queue:
      st === 'queued'
        ? '等待执行'
        : seen.clone || seen.install || seen.build || seen.deploy
          ? '已出队'
          : '等待执行',
    clone: stepDescByStatus(1, seen.clone ? '已拉取' : '进行中'),
    install: stepDescByStatus(2, seen.install ? '已安装' : '进行中'),
    lint: skippedLint ? '已跳过' : stepDescByStatus(3, seen.lint ? '已完成' : '进行中/可跳过'),
    test: skippedTest ? '已跳过' : stepDescByStatus(4, seen.test ? '已完成' : '进行中/可跳过'),
    build: stepDescByStatus(5, seen.build ? '已开始' : '进行中'),
    archive: stepDescByStatus(6, seen.archive ? '已完成' : '进行中'),
    deploy: stepDescByStatus(7, seen.deploy ? (seen.doneDeploy ? '已完成' : '进行中') : '进行中'),
    done: failed
      ? '已终止'
      : st === 'success'
        ? '成功'
        : seen.healthBad
          ? '健康检查失败'
          : seen.healthStart && !seen.healthOk
            ? '等待健康检查'
            : '等待完成',
  };

  return { currentIdx, status, desc, stepStatuses };
});

const flowDesc = computed(() => flowInfo.value.desc);
const flowStepStatuses = computed<StepStatus[]>(() => flowInfo.value.stepStatuses);

const flowStages = computed(() => {
  const d = flowDesc.value;
  const ss = flowStepStatuses.value;
  return [
    { key: 'queue', title: '排队中', icon: '⏳', status: (ss[0] ?? 'wait') as StepStatus, desc: d.queue },
    { key: 'clone', title: '拉取代码', icon: '🔽', status: (ss[1] ?? 'wait') as StepStatus, desc: d.clone },
    { key: 'install', title: '安装依赖', icon: '📦', status: (ss[2] ?? 'wait') as StepStatus, desc: d.install },
    { key: 'lint', title: '代码检查', icon: '🔎', status: (ss[3] ?? 'wait') as StepStatus, desc: d.lint },
    { key: 'test', title: '测试', icon: '🧪', status: (ss[4] ?? 'wait') as StepStatus, desc: d.test },
    { key: 'build', title: '构建产物', icon: '🏗️', status: (ss[5] ?? 'wait') as StepStatus, desc: d.build },
    { key: 'archive', title: '打包产物', icon: '🗜️', status: (ss[6] ?? 'wait') as StepStatus, desc: d.archive },
    { key: 'deploy', title: '发布部署', icon: '🚀', status: (ss[7] ?? 'wait') as StepStatus, desc: d.deploy },
    { key: 'done', title: '完成', icon: '🏁', status: (ss[8] ?? 'wait') as StepStatus, desc: d.done },
  ] as const;
});

function labelByStepStatus(s: StepStatus): string {
  if (s === 'finish') return '已完成';
  if (s === 'process') return '进行中';
  if (s === 'error') return '失败';
  return '未开始';
}

function tagTypeByStepStatus(s: StepStatus): 'success' | 'error' | 'warning' | 'info' | 'default' {
  if (s === 'finish') return 'success';
  if (s === 'process') return 'info';
  if (s === 'error') return 'error';
  return 'default';
}

function flowConnectorStatus(idx: number): StepStatus {
  const here = flowStepStatuses.value[idx];
  const next = flowStepStatuses.value[idx + 1];
  if (here === 'error') return 'error';
  if (here === 'finish' && next === 'finish') return 'finish';
  if (here === 'finish' && next === 'process') return 'process';
  if (here === 'process') return 'process';
  return 'wait';
}

/** 0ms 也是合法耗时，不能用 truthy 判断 durationMs */
const durationLabel = computed(() => {
  const d = deployment.value;
  if (!d) return '—';
  if (d.durationMs != null) return formatDuration(d.durationMs);
  if (d.status === 'success' || d.status === 'failed') return '—';
  return '进行中...';
});

const showLocalLoopbackHint = computed(() => {
  const d = deployment.value?.environment?.domain?.trim() ?? '';
  return d.length > 0 && isLoopbackHostLabel(d);
});

function readShipyardAccess(
  snap: Record<string, unknown> | null | undefined,
): ShipyardDeployAccessMeta | null {
  const raw = snap?.['shipyardAccess'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const port = o['staticPort'];
  const host = o['staticHost'];
  if (typeof port !== 'number' || typeof host !== 'string') return null;
  return { staticPort: port, staticHost: host };
}

const pm2StaticAccessUrl = computed(() => {
  const acc = readShipyardAccess(deployment.value?.configSnapshot ?? undefined);
  if (!acc) return '';
  const env = deployment.value?.environment;
  const host =
    resolveDeployAccessHost(env?.domain ?? null, acc.staticHost) || acc.staticHost;
  return `http://${host}:${acc.staticPort}/`;
});

const primaryAccessUrl = computed(() => {
  const env = deployment.value?.environment;
  const d = env?.domain?.trim();
  if (!d) return '';
  const host = resolveDeployAccessHost(d, env?.server?.host);
  return host ? normalizeSiteUrl(host) : '';
});

const secondaryAccessUrl = computed(() => {
  const hc = deployment.value?.environment?.healthCheckUrl?.trim() ?? '';
  if (!hc) return '';
  const pri = primaryAccessUrl.value;
  if (!pri) return hc;
  const stripTrail = (s: string) => s.replace(/\/+$/, '');
  if (stripTrail(hc) === stripTrail(pri)) return '';
  return hc;
});

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    message.success('已复制');
  } catch {
    message.error('复制失败');
  }
}

const statusMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  success: 'success',
  failed: 'error',
  building: 'warning',
  deploying: 'info',
  queued: 'default',
  pending_approval: 'warning',
};

let terminal: Terminal | null = null;
let socket: ReturnType<typeof io> | null = null;
const pollLogSeq = ref(-1);

const { pause: pauseLogPoll, resume: resumeLogPoll } = useIntervalFn(
  async () => {
    const slug = orgSlug.value;
    const proj = projectSlug.value;
    const id = deploymentId.value;
    if (!id || !terminal) return;
    try {
      const detail = await getDeploymentDetail(slug, proj, id);
      if (detail) deployment.value = detail;
      const logs = await getDeploymentLogs(slug, proj, id);
      const sorted = [...logs].sort((a, b) => a.seq - b.seq);
      for (const log of sorted) {
        if (log.seq > pollLogSeq.value) {
          terminal.writeln(log.content);
          logLines.value.push(log.content);
          pollLogSeq.value = log.seq;
        }
      }
      if (detail && ['success', 'failed'].includes(detail.status)) {
        pauseLogPoll();
        socket?.disconnect();
        socket = null;
      }
    } catch {
      /* 轮询失败时忽略，下次再试 */
    }
  },
  2000,
  { immediate: false },
);

function connectLiveLogStream(id: string) {
  socket?.disconnect();
  socket = io({ auth: { token: auth.accessToken } });
  socket.emit('subscribe:logs', { deploymentId: id });
  socket.on('log:line', (data: { deploymentId: string; line: string; seq?: number }) => {
    if (data.deploymentId !== id || !terminal) return;
    if (typeof data.seq === 'number' && data.seq <= pollLogSeq.value) return;
    terminal.writeln(data.line);
    logLines.value.push(data.line);
    if (typeof data.seq === 'number' && data.seq > pollLogSeq.value) {
      pollLogSeq.value = data.seq;
    }
  });
}

async function loadDeploymentView() {
  const slug = orgSlug.value;
  const proj = projectSlug.value;
  const id = deploymentId.value;

  pauseLogPoll();
  socket?.disconnect();
  socket = null;
  terminal?.dispose();
  terminal = null;
  logLines.value = [];

  deployment.value = await getDeploymentDetail(slug, proj, id).catch(() => null);

  await nextTick();
  if (!terminalEl.value) return;

  terminal = new Terminal({ theme: { background: '#1e1e1e' }, fontSize: 13, fontFamily: 'monospace' });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(terminalEl.value);
  fitAddon.fit();

  const logs = await getDeploymentLogs(slug, proj, id).catch(() => []);
  const sorted = [...logs].sort((a, b) => a.seq - b.seq);
  pollLogSeq.value = sorted.length ? Math.max(...sorted.map((l) => l.seq)) : -1;
  for (const log of sorted) {
    terminal.writeln(log.content);
    logLines.value.push(log.content);
  }

  const st = deployment.value?.status ?? '';
  if (['building', 'deploying', 'queued', 'pending_approval'].includes(st)) {
    connectLiveLogStream(id);
    resumeLogPoll();
  }
}

watch(
  () => [orgSlug.value, projectSlug.value, deploymentId.value] as const,
  () => {
    void loadDeploymentView();
  },
  { immediate: true },
);

watch(
  flowGroupsStorageKey,
  () => {
    expandedFlowGroups.value = readExpandedFlowGroups();
  },
  { immediate: true },
);

watch(
  expandedFlowGroups,
  (v) => {
    persistExpandedFlowGroups(v);
  },
  { deep: true },
);

onUnmounted(() => {
  pauseLogPoll();
  socket?.disconnect();
  terminal?.dispose();
});

async function handleRetry() {
  retrying.value = true;
  try {
    const next = await retryDeployment(orgSlug.value, projectSlug.value, deploymentId.value);
    message.success('已重新入队');
    if (next?.id) {
      await router.replace(`/orgs/${orgSlug.value}/projects/${projectSlug.value}/deployments/${next.id}`);
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '重试失败');
  } finally {
    retrying.value = false;
  }
}
</script>

<style scoped>
.flow2-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

@media (max-width: 1024px) {
  .flow2-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1025px) and (max-width: 1360px) {
  .flow2-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.flow2-group {
  border: 1px solid color-mix(in srgb, var(--n-border-color) 85%, transparent);
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--n-card-color) 96%, var(--n-color) 4%),
    var(--n-card-color)
  );
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.04);
  padding: 10px;
}

.flow2-group-head {
  padding: 2px 2px 8px;
}

.flow2-collapse-head {
  padding: 2px 2px 8px;
}

.flow2-group :deep(.n-collapse-item__header) {
  padding: 0;
}

.flow2-group :deep(.n-collapse-item__content-inner) {
  padding: 0;
}

.flow2-group-title {
  font-weight: 750;
  letter-spacing: 0.2px;
  font-size: 14px;
  color: var(--n-text-color);
}

.flow2-group-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.flow2-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 2px 4px;
}

.flow2-item {
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 10px;
  align-items: start;
}

.flow2-left {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flow-node {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  border: 1px solid var(--n-border-color);
  background: color-mix(in srgb, var(--n-card-color) 88%, var(--n-color) 12%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.flow-node-icon {
  position: relative;
  z-index: 1;
}

.flow2-item[data-status='process'] .flow-card > * {
  position: relative;
  z-index: 1;
}

.flow-card {
  position: relative;
  z-index: 0;
}

@keyframes flow-glow-scan {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}

.flow-node[data-status='finish'] {
  border-color: color-mix(in srgb, var(--n-success-color) 55%, var(--n-border-color));
  background: color-mix(in srgb, var(--n-success-color) 10%, var(--n-card-color));
}

.flow2-item[data-status='finish'] .flow-card {
  border-color: color-mix(in srgb, var(--n-success-color) 40%, var(--n-border-color));
}

.flow2-item[data-status='finish'] .flow-card > * {
  position: relative;
  z-index: 1;
}

.flow-card {
  position: relative;
}

.flow-node[data-status='error'] {
  border-color: color-mix(in srgb, var(--n-error-color) 60%, var(--n-border-color));
  background: color-mix(in srgb, var(--n-error-color) 10%, var(--n-card-color));
}

.flow-node-icon {
  font-size: 16px;
  line-height: 1;
}

.flow2-connector-vert {
  width: 2px;
  height: 22px;
  margin-top: 6px;
  background: color-mix(in srgb, var(--n-border-color) 80%, transparent);
}

.flow2-connector-vert[data-status='process'] {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--n-info-color) 60%, var(--n-border-color)),
    color-mix(in srgb, var(--n-border-color) 70%, transparent)
  );
}

.flow2-connector-vert[data-status='finish'] {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--n-success-color) 70%, var(--n-border-color)),
    color-mix(in srgb, var(--n-border-color) 70%, transparent)
  );
}

.flow2-connector-vert[data-status='error'] {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--n-error-color) 70%, var(--n-border-color)),
    color-mix(in srgb, var(--n-border-color) 70%, transparent)
  );
}

.flow-card {
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--n-border-color) 85%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--n-card-color) 96%, var(--n-color) 4%),
    var(--n-card-color)
  );
  padding: 10px 10px 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.045);
}

/* 失败节点：卡片边框高亮为红色 */
.flow2-item[data-status='error'] .flow-card {
  /* 直接用 error 色，避免 color-mix 过于发灰 */
  border-color: var(--n-error-color, #ef4444);
  box-shadow: 0 12px 30px rgba(239, 68, 68, 0.14);
}

.flow2-card {
  margin-top: 0;
}

.flow-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.flow-title {
  font-weight: 650;
  font-size: 12px;
  color: var(--n-text-color);
  letter-spacing: 0.2px;
}

.flow-tag {
  flex: 0 0 auto;
}

.flow-desc {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--n-text-color-3);
  min-height: 28px;
}
</style>
