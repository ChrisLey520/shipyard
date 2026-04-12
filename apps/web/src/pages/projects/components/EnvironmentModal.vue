<template>
  <n-modal
    v-model:show="showProxy"
    :title="modalTitle"
    preset="card"
    style="width: 600px"
    :mask-closable="false"
    :close-on-esc="false"
  >
    <n-form :model="envForm" label-placement="left" label-width="100">
      <n-form-item label="环境名称"><n-input v-model:value="envForm.name" /></n-form-item>
      <n-form-item label="触发分支">
        <n-select
          v-model:value="envForm.triggerBranch"
          filterable
          tag
          clearable
          :options="branchOptions"
          :loading="loadingBranches"
          placeholder="选择或输入分支（如 main）"
        />
      </n-form-item>
      <n-form-item label="服务器">
        <n-select
          v-model:value="envForm.serverId"
          :options="serverOptions"
          clearable
          placeholder="请选择服务器"
        />
      </n-form-item>

      <n-form-item>
        <template #label>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; width: 100%">
            <span style="line-height: 1">部署路径</span>
            <n-popover trigger="hover" placement="top" :width="360">
              <template #trigger>
                <n-button size="tiny" secondary circle style="width: 18px; height: 18px; padding: 0">
                  <span style="font-size: 12px; line-height: 1">i</span>
                </n-button>
              </template>
              <div style="font-size: 12px; line-height: 1.6">
                <div style="font-weight: 600; margin-bottom: 6px">推荐路径示例（绝对路径）</div>
                <div style="margin-bottom: 6px">
                  <n-text strong>Linux</n-text>：
                  <n-text code>/var/www/myapp</n-text>
                  或
                  <n-text code>/opt/shipyard/apps/myapp</n-text>
                </div>
                <div style="margin-bottom: 6px">
                  <n-text strong>macOS</n-text>：
                  <n-text code>/usr/local/var/www/myapp</n-text>
                  或
                  <n-text code>/Users/Shared/shipyard/myapp</n-text>
                </div>
                <div>
                  <n-text strong>Windows</n-text>（如使用）：
                  <n-text code>C:\\shipyard\\apps\\myapp</n-text>
                </div>
              </div>
            </n-popover>
          </div>
        </template>
        <n-input v-model:value="envForm.deployPath" placeholder="/var/www/myapp" />
      </n-form-item>

      <n-form-item>
        <template #label>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; width: 100%">
            <span style="line-height: 1">域名</span>
            <n-popover trigger="hover" placement="top" :width="360">
              <template #trigger>
                <n-button size="tiny" secondary circle style="width: 18px; height: 18px; padding: 0">
                  <span style="font-size: 12px; line-height: 1">i</span>
                </n-button>
              </template>
              <div style="font-size: 12px; line-height: 1.6">
                须与浏览器里实际输入的主机名一致。远程服务器不要填 localhost（会指到您自己的电脑）。
                本机调试且服务器填 127.0.0.1/localhost 时：站点由 Nginx 提供在
                <n-text strong>80 端口</n-text>
                ，与 Shipyard API、Vite 等不是同一端口；需本机已安装 Nginx、主配置包含站点 include，且 80 未被占用。
                若 SSH 登记的是局域网 IP，部署会为 Nginx 同时写入 localhost、127.0.0.1 与该 IP，便于本机多种方式访问。
                macOS 未检测到 Homebrew Nginx 时，静态站点会自动用 Node + PM2 在固定端口提供访问（需本机已安装 pm2 与 node）。
              </div>
            </n-popover>
          </div>
        </template>
        <n-input v-model:value="envForm.domain" placeholder="如 app.example.com 或服务器可访问 IP" />
      </n-form-item>

      <n-form-item label="健康检查 URL"><n-input v-model:value="envForm.healthCheckUrl" placeholder="https://myapp.com/health" /></n-form-item>
      <n-form-item label="受保护">
        <n-switch v-model:value="envForm.protected" />
      </n-form-item>

      <n-form-item label="附加部署服务器">
        <n-select
          v-model:value="envForm.extraServerIds"
          :options="extraServerOptions"
          multiple
          clearable
          filterable
          placeholder="除主服务器外，滚动/多机时的其它目标（顺序即部署顺序）"
        />
      </n-form-item>

      <n-form-item label="执行器">
        <n-select
          v-model:value="envForm.executor"
          :options="executorOptions"
          placeholder="SSH 或 Kubernetes"
        />
      </n-form-item>
      <n-form-item label="发布策略">
        <n-select
          v-model:value="envForm.strategy"
          :options="strategyOptionsForExecutor"
          placeholder="direct / 蓝绿 / 滚动 / 金丝雀"
        />
      </n-form-item>

      <template v-if="envForm.executor === 'kubernetes'">
        <n-form-item label="rollout 超时(秒)">
          <n-input-number
            v-model:value="envForm.k8sRolloutTimeoutSeconds"
            :min="60"
            :max="3600"
            :step="30"
            clearable
            placeholder="默认 600；留空用默认"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="rolling maxSurge">
          <n-input v-model:value="envForm.k8sMaxSurge" placeholder="如 25% 或 1；策略为 rolling 且 set image 前 patch" />
        </n-form-item>
        <n-form-item label="rolling maxUnavailable">
          <n-input v-model:value="envForm.k8sMaxUnavailable" placeholder="如 25% 或 0" />
        </n-form-item>
      </template>

      <template v-if="envForm.executor === 'object_storage'">
        <n-form-item label="S3 Bucket">
          <n-input v-model:value="envForm.ossBucket" placeholder="my-static-bucket" />
        </n-form-item>
        <n-form-item label="对象前缀">
          <n-input v-model:value="envForm.ossPrefix" placeholder="可选，如 prod/app/" />
        </n-form-item>
        <n-form-item label="区域">
          <n-input v-model:value="envForm.ossRegion" placeholder="如 ap-northeast-1，可选" />
        </n-form-item>
      </template>

      <template v-if="envForm.strategy === 'canary' && envForm.executor === 'ssh'">
        <n-form-item label="金丝雀生成模板">
          <n-select
            v-model:value="envForm.canaryTemplate"
            :options="canaryTemplateOptions"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="金丝雀片段路径">
          <n-input
            v-model:value="envForm.canaryPath"
            placeholder="/etc/nginx/snippets/myapp-canary.conf"
          />
        </n-form-item>
        <n-form-item label="流量百分比">
          <n-input-number
            v-model:value="envForm.canaryPercent"
            :min="0"
            :max="100"
            :step="1"
            style="width: 100%"
            placeholder="生成片段用；手写片段可忽略"
          />
        </n-form-item>
        <template v-if="envForm.canaryTemplate === 'split_clients'">
          <n-form-item label="stable upstream">
            <n-input v-model:value="envForm.stableUpstream" placeholder="与主配置中 upstream 名一致" />
          </n-form-item>
          <n-form-item label="candidate upstream">
            <n-input v-model:value="envForm.candidateUpstream" placeholder="候选版本 upstream 名" />
          </n-form-item>
        </template>
        <template v-else>
          <n-form-item label="upstream 块名称">
            <n-input v-model:value="envForm.canaryUpstreamName" placeholder="与 proxy_pass 中名称一致" />
          </n-form-item>
          <n-form-item label="stable 后端 host:port">
            <n-input v-model:value="envForm.stableBackend" placeholder="如 127.0.0.1:3001 或 [::1]:8080" />
          </n-form-item>
          <n-form-item label="candidate 后端 host:port">
            <n-input v-model:value="envForm.candidateBackend" placeholder="候选实例地址" />
          </n-form-item>
        </template>
        <n-form-item label="自定义片段（可选）">
          <n-input
            v-model:value="envForm.canaryBodyAdvanced"
            type="textarea"
            placeholder="非空则完全使用此处内容，忽略上方百分比与 upstream；仍写入「金丝雀片段路径」"
            :rows="3"
            :autosize="{ minRows: 2, maxRows: 8 }"
          />
        </n-form-item>
      </template>

      <n-form-item :show-feedback="false">
        <template #label>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; width: 100%">
            <span style="line-height: 1">发布配置 (JSON)</span>
            <n-popover trigger="hover" placement="top" :width="360">
              <template #trigger>
                <n-button size="tiny" secondary circle style="width: 18px; height: 18px; padding: 0">
                  <span style="font-size: 12px; line-height: 1">i</span>
                </n-button>
              </template>
              <div style="font-size: 12px; line-height: 1.6">
                可与上方执行器/策略合并保存。缺省与留空等价于 <n-text code>ssh</n-text> +
                <n-text code>direct</n-text>。金丝雀生成模式须主配置
                <n-text code>include</n-text> 片段并在 <n-text code>server</n-text> 内使用
                <n-text code>proxy_pass http://$shipyard_canary_pool;</n-text>
                （split_clients）；upstream_weight 时 include 后为同名 upstream 的
                <n-text code>proxy_pass http://…;</n-text>。
              </div>
            </n-popover>
          </div>
        </template>
        <n-input
          v-model:value="envForm.releaseConfigJson"
          type="textarea"
          placeholder='{"executor":"ssh","strategy":"direct"}'
          :rows="6"
          :autosize="{ minRows: 4, maxRows: 14 }"
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="showProxy = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ primaryLabel }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch, watchEffect } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  NButton,
  NSpace,
  NPopover,
  NText,
  NInputNumber,
  useMessage,
} from 'naive-ui';
import { serverOsLabel } from '@shipyard/shared';
import {
  useEnvironmentsProjectActions,
  type Env,
} from '@/composables/projects/useEnvironmentsProjectActions';

const props = defineProps<{
  show: boolean;
  mode: 'create' | 'edit';
  orgSlug: string;
  projectSlug: string;
  initialEnv: Env | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'saved'): void;
}>();

const message = useMessage();

const envApi = useEnvironmentsProjectActions(toRef(props, 'orgSlug'), toRef(props, 'projectSlug'));

const executorOptions = [
  { label: 'SSH', value: 'ssh' },
  { label: 'Kubernetes', value: 'kubernetes' },
  { label: '对象存储 S3', value: 'object_storage' },
];

const strategyOptions = [
  { label: 'direct（直连）', value: 'direct' },
  { label: 'blue_green（蓝绿）', value: 'blue_green' },
  { label: 'rolling（滚动/多机）', value: 'rolling' },
  { label: 'canary（金丝雀）', value: 'canary' },
];

const canaryTemplateOptions = [
  { label: 'split_clients（按 upstream 名分流）', value: 'split_clients' },
  { label: 'upstream_weight（双 server 权重）', value: 'upstream_weight' },
];

const showProxy = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
});

const modalTitle = computed(() => (props.mode === 'edit' ? '编辑环境' : '新建环境'));
const primaryLabel = computed(() => (props.mode === 'edit' ? '保存' : '创建'));

type EnvFormState = {
  name: string;
  triggerBranch: string;
  serverId: string | null;
  deployPath: string;
  domain: string;
  healthCheckUrl: string;
  protected: boolean;
  extraServerIds: string[];
  executor: 'ssh' | 'kubernetes' | 'object_storage';
  strategy: 'direct' | 'blue_green' | 'rolling' | 'canary';
  canaryTemplate: 'split_clients' | 'upstream_weight';
  canaryPath: string;
  canaryPercent: number;
  stableUpstream: string;
  candidateUpstream: string;
  canaryUpstreamName: string;
  stableBackend: string;
  candidateBackend: string;
  canaryBodyAdvanced: string;
  k8sRolloutTimeoutSeconds: number | null;
  k8sMaxSurge: string;
  k8sMaxUnavailable: string;
  ossBucket: string;
  ossPrefix: string;
  ossRegion: string;
  releaseConfigJson: string;
};

const envForm = ref<EnvFormState>({
  name: '',
  triggerBranch: 'main',
  serverId: null,
  deployPath: '',
  domain: '',
  healthCheckUrl: '',
  protected: false,
  extraServerIds: [],
  executor: 'ssh',
  strategy: 'direct',
  canaryTemplate: 'split_clients',
  canaryPath: '',
  canaryPercent: 10,
  stableUpstream: '',
  candidateUpstream: '',
  canaryUpstreamName: '',
  stableBackend: '',
  candidateBackend: '',
  canaryBodyAdvanced: '',
  k8sRolloutTimeoutSeconds: null,
  k8sMaxSurge: '',
  k8sMaxUnavailable: '',
  ossBucket: '',
  ossPrefix: '',
  ossRegion: '',
  releaseConfigJson: '',
});

const strategyOptionsForExecutor = computed(() => {
  const ex = envForm.value.executor;
  if (ex === 'kubernetes') {
    return strategyOptions.filter((s) => s.value === 'direct' || s.value === 'rolling');
  }
  if (ex === 'object_storage') {
    return strategyOptions.filter((s) => s.value === 'direct');
  }
  return strategyOptions;
});

watchEffect(() => {
  const allowed = strategyOptionsForExecutor.value.map((o) => o.value);
  if (!allowed.includes(envForm.value.strategy)) {
    envForm.value.strategy = 'direct';
  }
});

const submitting = ref(false);
const loadingBranches = ref(false);
const branchOptions = ref<Array<{ label: string; value: string }>>([]);
const serverOptions = ref<Array<{ label: string; value: string }>>([]);

const extraServerOptions = computed(() =>
  serverOptions.value.filter((o) => o.value !== envForm.value.serverId),
);

function releaseConfigFormMeta(rc: unknown) {
  const defaults = {
    executor: 'ssh' as EnvFormState['executor'],
    strategy: 'direct' as EnvFormState['strategy'],
    canaryTemplate: 'split_clients' as EnvFormState['canaryTemplate'],
    canaryPath: '',
    canaryPercent: 10,
    stableUpstream: '',
    candidateUpstream: '',
    canaryUpstreamName: '',
    stableBackend: '',
    candidateBackend: '',
    canaryBodyAdvanced: '',
    k8sRolloutTimeoutSeconds: null as number | null,
    k8sMaxSurge: '',
    k8sMaxUnavailable: '',
    ossBucket: '',
    ossPrefix: '',
    ossRegion: '',
  };
  if (!rc || typeof rc !== 'object') {
    return defaults;
  }
  const o = rc as Record<string, unknown>;
  const executor: EnvFormState['executor'] =
    o.executor === 'object_storage'
      ? 'object_storage'
      : o.executor === 'kubernetes'
        ? 'kubernetes'
        : 'ssh';
  const s = o.strategy;
  const strategy: EnvFormState['strategy'] =
    s === 'blue_green' || s === 'rolling' || s === 'canary' ? s : 'direct';
  const ssh =
    o.ssh && typeof o.ssh === 'object' && o.ssh !== null
      ? (o.ssh as Record<string, unknown>)
      : {};
  const k =
    o.kubernetes && typeof o.kubernetes === 'object' && o.kubernetes !== null
      ? (o.kubernetes as Record<string, unknown>)
      : {};
  const os =
    o.objectStorage && typeof o.objectStorage === 'object' && o.objectStorage !== null
      ? (o.objectStorage as Record<string, unknown>)
      : {};
  const tmpl: EnvFormState['canaryTemplate'] =
    ssh.nginxCanaryTemplate === 'upstream_weight' ? 'upstream_weight' : 'split_clients';
  return {
    executor,
    strategy,
    canaryTemplate: tmpl,
    canaryPath: typeof ssh.nginxCanaryPath === 'string' ? ssh.nginxCanaryPath : '',
    canaryPercent: typeof ssh.canaryPercent === 'number' ? ssh.canaryPercent : 10,
    stableUpstream:
      typeof ssh.nginxCanaryStableUpstream === 'string' ? ssh.nginxCanaryStableUpstream : '',
    candidateUpstream:
      typeof ssh.nginxCanaryCandidateUpstream === 'string' ? ssh.nginxCanaryCandidateUpstream : '',
    canaryUpstreamName:
      typeof ssh.nginxCanaryUpstreamName === 'string' ? ssh.nginxCanaryUpstreamName : '',
    stableBackend:
      typeof ssh.nginxCanaryStableBackend === 'string' ? ssh.nginxCanaryStableBackend : '',
    candidateBackend:
      typeof ssh.nginxCanaryCandidateBackend === 'string' ? ssh.nginxCanaryCandidateBackend : '',
    canaryBodyAdvanced: typeof ssh.nginxCanaryBody === 'string' ? ssh.nginxCanaryBody : '',
    k8sRolloutTimeoutSeconds:
      typeof k.rolloutTimeoutSeconds === 'number' ? k.rolloutTimeoutSeconds : null,
    k8sMaxSurge: typeof k.rollingUpdateMaxSurge === 'string' ? k.rollingUpdateMaxSurge : '',
    k8sMaxUnavailable:
      typeof k.rollingUpdateMaxUnavailable === 'string' ? k.rollingUpdateMaxUnavailable : '',
    ossBucket: typeof os.bucket === 'string' ? os.bucket : '',
    ossPrefix: typeof os.prefix === 'string' ? os.prefix : '',
    ossRegion: typeof os.region === 'string' ? os.region : '',
  };
}

function resetFromInitial() {
  const e = props.initialEnv;
  if (props.mode === 'edit' && e) {
    const targets = e.environmentServers?.length
      ? [...e.environmentServers].sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    const primaryId = e.server?.id ?? targets[0]?.serverId ?? null;
    const extras = targets
      .map((t) => t.serverId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && id !== primaryId);
    const meta = releaseConfigFormMeta(e.releaseConfig);
    envForm.value = {
      name: e.name,
      triggerBranch: e.triggerBranch,
      serverId: primaryId,
      deployPath: e.deployPath,
      domain: e.domain ?? '',
      healthCheckUrl: e.healthCheckUrl ?? '',
      protected: e.protected,
      extraServerIds: extras,
      executor: meta.executor,
      strategy: meta.strategy,
      canaryTemplate: meta.canaryTemplate,
      canaryPath: meta.canaryPath,
      canaryPercent: meta.canaryPercent,
      stableUpstream: meta.stableUpstream,
      candidateUpstream: meta.candidateUpstream,
      canaryUpstreamName: meta.canaryUpstreamName,
      stableBackend: meta.stableBackend,
      candidateBackend: meta.candidateBackend,
      canaryBodyAdvanced: meta.canaryBodyAdvanced,
      k8sRolloutTimeoutSeconds: meta.k8sRolloutTimeoutSeconds,
      k8sMaxSurge: meta.k8sMaxSurge,
      k8sMaxUnavailable: meta.k8sMaxUnavailable,
      ossBucket: meta.ossBucket,
      ossPrefix: meta.ossPrefix,
      ossRegion: meta.ossRegion,
      releaseConfigJson: releaseConfigToJsonString(e.releaseConfig),
    };
    return;
  }
  envForm.value = {
    name: '',
    triggerBranch: 'main',
    serverId: null,
    deployPath: '',
    domain: '',
    healthCheckUrl: '',
    protected: false,
    extraServerIds: [],
    executor: 'ssh',
    strategy: 'direct',
    canaryTemplate: 'split_clients',
    canaryPath: '',
    canaryPercent: 10,
    stableUpstream: '',
    candidateUpstream: '',
    canaryUpstreamName: '',
    stableBackend: '',
    candidateBackend: '',
    canaryBodyAdvanced: '',
    k8sRolloutTimeoutSeconds: null,
    k8sMaxSurge: '',
    k8sMaxUnavailable: '',
    ossBucket: '',
    ossPrefix: '',
    ossRegion: '',
    releaseConfigJson: '',
  };
}

function releaseConfigToJsonString(rc: unknown): string {
  if (rc == null) return '';
  try {
    return JSON.stringify(rc, null, 2);
  } catch {
    return '';
  }
}

async function ensureOptionsLoaded() {
  const servers = await envApi.listServersForOrg();
  serverOptions.value = (servers ?? []).map((s) => ({
    label: `${s.name}（${serverOsLabel(s.os)}）`,
    value: s.id,
  }));
  try {
    const branches = await envApi.listProjectBranches();
    branchOptions.value = (branches ?? []).map((b) => ({ label: b, value: b }));
  } catch {
    branchOptions.value = [];
  }
}

watch(
  () => [props.show, props.mode, props.initialEnv?.id] as const,
  async ([open]) => {
    if (!open) return;
    loadingBranches.value = true;
    try {
      // 须先拉取服务器/分支选项，再写入表单；否则 NSelect 在 options 为空时绑定已有 value 可能抛错
      await ensureOptionsLoaded();
      resetFromInitial();
    } catch {
      serverOptions.value = [];
      branchOptions.value = [];
      resetFromInitial();
    } finally {
      loadingBranches.value = false;
    }
  },
);

/** 合并 JSON 文本框与执行器/策略/金丝雀表单字段 */
function composeReleaseConfigForSubmit():
  | { ok: true; value: unknown | undefined | null }
  | { ok: false } {
  const rawTrim = envForm.value.releaseConfigJson.trim();
  let base: Record<string, unknown> = {};
  if (rawTrim) {
    try {
      base = JSON.parse(rawTrim) as Record<string, unknown>;
    } catch {
      message.error('发布配置 JSON 无法解析');
      return { ok: false };
    }
  }

  const { executor, strategy } = envForm.value;

  if (!rawTrim && props.mode === 'create' && executor === 'ssh' && strategy === 'direct') {
    return { ok: true, value: undefined };
  }

  if (
    !rawTrim &&
    props.mode === 'edit' &&
    props.initialEnv?.releaseConfig != null &&
    executor === 'ssh' &&
    strategy === 'direct'
  ) {
    return { ok: true, value: null };
  }

  const out: Record<string, unknown> = { ...base, executor, strategy };

  if (executor === 'object_storage') {
    delete out.kubernetes;
    delete out.ssh;
    const b = envForm.value.ossBucket.trim();
    out.objectStorage = {
      provider: 's3',
      bucket: b,
      ...(envForm.value.ossPrefix.trim() ? { prefix: envForm.value.ossPrefix.trim() } : {}),
      ...(envForm.value.ossRegion.trim() ? { region: envForm.value.ossRegion.trim() } : {}),
    };
    return { ok: true, value: out };
  }

  delete out.objectStorage;

  if (executor === 'kubernetes') {
    const prev =
      out.kubernetes && typeof out.kubernetes === 'object' && out.kubernetes !== null
        ? { ...(out.kubernetes as Record<string, unknown>) }
        : {};
    if (envForm.value.k8sRolloutTimeoutSeconds != null) {
      prev.rolloutTimeoutSeconds = envForm.value.k8sRolloutTimeoutSeconds;
    } else {
      delete prev.rolloutTimeoutSeconds;
    }
    const ms = envForm.value.k8sMaxSurge.trim();
    const mu = envForm.value.k8sMaxUnavailable.trim();
    if (ms) prev.rollingUpdateMaxSurge = ms;
    else delete prev.rollingUpdateMaxSurge;
    if (mu) prev.rollingUpdateMaxUnavailable = mu;
    else delete prev.rollingUpdateMaxUnavailable;
    out.kubernetes = prev;
    delete out.ssh;
  } else {
    delete out.kubernetes;
  }

  if (strategy === 'canary' && executor === 'ssh') {
    const prev =
      out.ssh && typeof out.ssh === 'object' && out.ssh !== null
        ? { ...(out.ssh as Record<string, unknown>) }
        : {};
    const ssh: Record<string, unknown> = { ...prev };
    const pathTrim = envForm.value.canaryPath.trim();
    if (pathTrim) ssh.nginxCanaryPath = pathTrim;
    else delete ssh.nginxCanaryPath;
    const adv = envForm.value.canaryBodyAdvanced.trim();
    if (adv) {
      ssh.nginxCanaryBody = adv;
    } else {
      delete ssh.nginxCanaryBody;
      ssh.canaryPercent = envForm.value.canaryPercent;
      ssh.nginxCanaryTemplate = envForm.value.canaryTemplate;
      if (envForm.value.canaryTemplate === 'upstream_weight') {
        const uw = envForm.value.canaryUpstreamName.trim();
        const sb = envForm.value.stableBackend.trim();
        const cb = envForm.value.candidateBackend.trim();
        if (uw) ssh.nginxCanaryUpstreamName = uw;
        else delete ssh.nginxCanaryUpstreamName;
        if (sb) ssh.nginxCanaryStableBackend = sb;
        else delete ssh.nginxCanaryStableBackend;
        if (cb) ssh.nginxCanaryCandidateBackend = cb;
        else delete ssh.nginxCanaryCandidateBackend;
        delete ssh.nginxCanaryStableUpstream;
        delete ssh.nginxCanaryCandidateUpstream;
      } else {
        const su = envForm.value.stableUpstream.trim();
        const cu = envForm.value.candidateUpstream.trim();
        if (su) ssh.nginxCanaryStableUpstream = su;
        else delete ssh.nginxCanaryStableUpstream;
        if (cu) ssh.nginxCanaryCandidateUpstream = cu;
        else delete ssh.nginxCanaryCandidateUpstream;
        delete ssh.nginxCanaryUpstreamName;
        delete ssh.nginxCanaryStableBackend;
        delete ssh.nginxCanaryCandidateBackend;
      }
    }
    out.ssh = ssh;
  } else if (out.ssh && typeof out.ssh === 'object' && out.ssh !== null) {
    const ssh = { ...(out.ssh as Record<string, unknown>) };
    delete ssh.nginxCanaryPath;
    delete ssh.nginxCanaryBody;
    delete ssh.nginxCanaryTemplate;
    delete ssh.canaryPercent;
    delete ssh.nginxCanaryStableUpstream;
    delete ssh.nginxCanaryCandidateUpstream;
    delete ssh.nginxCanaryUpstreamName;
    delete ssh.nginxCanaryStableBackend;
    delete ssh.nginxCanaryCandidateBackend;
    if (Object.keys(ssh).length === 0) delete out.ssh;
    else out.ssh = ssh;
  }

  return { ok: true, value: out };
}

function buildEnvironmentTargets(primary: string): Array<{ serverId: string; sortOrder: number }> {
  const seen = new Set<string>();
  const targets: Array<{ serverId: string; sortOrder: number }> = [];
  seen.add(primary);
  targets.push({ serverId: primary, sortOrder: 0 });
  let order = 1;
  for (const id of envForm.value.extraServerIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    targets.push({ serverId: id, sortOrder: order++ });
  }
  return targets;
}

async function handleSubmit() {
  if (!envForm.value.serverId) {
    message.warning('请选择服务器');
    return;
  }
  const name = envForm.value.name.trim();
  const triggerBranch = envForm.value.triggerBranch?.trim() ?? '';
  const deployPath = envForm.value.deployPath.trim();
  if (!name || !triggerBranch || !deployPath) {
    message.warning('请填写环境名称、触发分支与部署路径');
    return;
  }

  if (envForm.value.strategy === 'canary' && envForm.value.executor === 'kubernetes') {
    message.warning('Kubernetes 执行器不支持金丝雀策略，请改为 SSH 或调整策略');
    return;
  }
  if (envForm.value.strategy === 'blue_green' && envForm.value.executor === 'kubernetes') {
    message.warning('Kubernetes 执行器不支持蓝绿策略，请改为 SSH 或调整策略');
    return;
  }
  if (envForm.value.executor === 'object_storage' && !envForm.value.ossBucket.trim()) {
    message.warning('请填写 S3 Bucket');
    return;
  }

  const rcParsed = composeReleaseConfigForSubmit();
  if (!rcParsed.ok) return;

  submitting.value = true;
  try {
    const targets = buildEnvironmentTargets(envForm.value.serverId);
    if (props.mode === 'edit') {
      if (!props.initialEnv?.id) throw new Error('missing env id');
      await envApi.updateEnvironment(props.initialEnv.id, {
        name,
        triggerBranch,
        serverId: envForm.value.serverId,
        deployPath,
        domain: envForm.value.domain.trim() ? envForm.value.domain.trim() : null,
        healthCheckUrl: envForm.value.healthCheckUrl.trim()
          ? envForm.value.healthCheckUrl.trim()
          : null,
        protected: envForm.value.protected,
        ...(rcParsed.value !== undefined ? { releaseConfig: rcParsed.value } : {}),
        environmentTargets: targets,
      });
      message.success('已保存');
    } else {
      await envApi.createEnvironment({
        name,
        triggerBranch,
        serverId: envForm.value.serverId,
        deployPath,
        domain: envForm.value.domain.trim() || undefined,
        healthCheckUrl: envForm.value.healthCheckUrl.trim() || undefined,
        protected: envForm.value.protected,
        ...(rcParsed.value !== undefined ? { releaseConfig: rcParsed.value } : {}),
        environmentTargets: targets,
      });
      message.success('环境创建成功');
    }
    showProxy.value = false;
    emit('saved');
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    submitting.value = false;
  }
}
</script>
