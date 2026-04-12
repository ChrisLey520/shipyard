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
        <n-select v-model:value="envForm.strategy" :options="strategyOptions" placeholder="direct / 蓝绿 / 滚动 / 金丝雀" />
      </n-form-item>

      <template v-if="envForm.strategy === 'canary' && envForm.executor === 'ssh'">
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
            placeholder="生成 split_clients 时用；手写片段可忽略"
          />
        </n-form-item>
        <n-form-item label="stable upstream">
          <n-input v-model:value="envForm.stableUpstream" placeholder="与主配置中 upstream 名一致" />
        </n-form-item>
        <n-form-item label="candidate upstream">
          <n-input v-model:value="envForm.candidateUpstream" placeholder="候选版本 upstream 名" />
        </n-form-item>
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
                <n-text code>proxy_pass http://$shipyard_canary_pool;</n-text>。
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
import { computed, ref, toRef, watch } from 'vue';
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
];

const strategyOptions = [
  { label: 'direct（直连）', value: 'direct' },
  { label: 'blue_green（蓝绿）', value: 'blue_green' },
  { label: 'rolling（滚动/多机）', value: 'rolling' },
  { label: 'canary（金丝雀）', value: 'canary' },
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
  executor: 'ssh' | 'kubernetes';
  strategy: 'direct' | 'blue_green' | 'rolling' | 'canary';
  canaryPath: string;
  canaryPercent: number;
  stableUpstream: string;
  candidateUpstream: string;
  canaryBodyAdvanced: string;
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
  canaryPath: '',
  canaryPercent: 10,
  stableUpstream: '',
  candidateUpstream: '',
  canaryBodyAdvanced: '',
  releaseConfigJson: '',
});

const submitting = ref(false);
const loadingBranches = ref(false);
const branchOptions = ref<Array<{ label: string; value: string }>>([]);
const serverOptions = ref<Array<{ label: string; value: string }>>([]);

const extraServerOptions = computed(() =>
  serverOptions.value.filter((o) => o.value !== envForm.value.serverId),
);

function releaseConfigFormMeta(rc: unknown) {
  if (!rc || typeof rc !== 'object') {
    return {
      executor: 'ssh' as const,
      strategy: 'direct' as const,
      canaryPath: '',
      canaryPercent: 10,
      stableUpstream: '',
      candidateUpstream: '',
      canaryBodyAdvanced: '',
    };
  }
  const o = rc as Record<string, unknown>;
  const executor = o.executor === 'kubernetes' ? ('kubernetes' as const) : ('ssh' as const);
  const s = o.strategy;
  const strategy: EnvFormState['strategy'] =
    s === 'blue_green' || s === 'rolling' || s === 'canary' ? s : 'direct';
  const ssh =
    o.ssh && typeof o.ssh === 'object' && o.ssh !== null
      ? (o.ssh as Record<string, unknown>)
      : {};
  return {
    executor,
    strategy,
    canaryPath: typeof ssh.nginxCanaryPath === 'string' ? ssh.nginxCanaryPath : '',
    canaryPercent: typeof ssh.canaryPercent === 'number' ? ssh.canaryPercent : 10,
    stableUpstream:
      typeof ssh.nginxCanaryStableUpstream === 'string' ? ssh.nginxCanaryStableUpstream : '',
    candidateUpstream:
      typeof ssh.nginxCanaryCandidateUpstream === 'string' ? ssh.nginxCanaryCandidateUpstream : '',
    canaryBodyAdvanced: typeof ssh.nginxCanaryBody === 'string' ? ssh.nginxCanaryBody : '',
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
      canaryPath: meta.canaryPath,
      canaryPercent: meta.canaryPercent,
      stableUpstream: meta.stableUpstream,
      candidateUpstream: meta.candidateUpstream,
      canaryBodyAdvanced: meta.canaryBodyAdvanced,
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
    canaryPath: '',
    canaryPercent: 10,
    stableUpstream: '',
    candidateUpstream: '',
    canaryBodyAdvanced: '',
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
      const su = envForm.value.stableUpstream.trim();
      const cu = envForm.value.candidateUpstream.trim();
      if (su) ssh.nginxCanaryStableUpstream = su;
      else delete ssh.nginxCanaryStableUpstream;
      if (cu) ssh.nginxCanaryCandidateUpstream = cu;
      else delete ssh.nginxCanaryCandidateUpstream;
    }
    out.ssh = ssh;
  } else if (out.ssh && typeof out.ssh === 'object' && out.ssh !== null) {
    const ssh = { ...(out.ssh as Record<string, unknown>) };
    delete ssh.nginxCanaryPath;
    delete ssh.nginxCanaryBody;
    delete ssh.canaryPercent;
    delete ssh.nginxCanaryStableUpstream;
    delete ssh.nginxCanaryCandidateUpstream;
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
