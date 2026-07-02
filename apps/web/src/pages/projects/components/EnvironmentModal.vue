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
      <n-form-item label="执行器">
        <n-select
          v-model:value="envForm.executor"
          :options="executorOptions"
          placeholder="选择部署执行器"
        />
      </n-form-item>
      <n-form-item v-if="envForm.executor === 'ssh'" label="服务器">
        <n-select
          v-model:value="envForm.serverId"
          :options="serverOptions"
          clearable
          placeholder="请选择 SSH 服务器"
        />
      </n-form-item>

      <n-alert v-if="envForm.executor === 'local'" type="info" :show-icon="false" class="mb-3">
        本机部署会在运行 Shipyard Worker 的机器上执行，不走 SSH，也不需要添加服务器。若 Worker 跑在 K8s Pod 内，部署路径需是 Pod 可见的挂载目录。
      </n-alert>

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
                须与浏览器里实际输入的主机名一致。远程 SSH 服务器不要填 localhost（会指到您自己的电脑）。
                本机执行器或 SSH 目标为 127.0.0.1/localhost 时：站点由 Nginx 提供在
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

      <n-form-item v-if="envForm.executor === 'ssh'" label="附加部署服务器">
        <n-select
          v-model:value="envForm.extraServerIds"
          :options="extraServerOptions"
          multiple
          clearable
          filterable
          placeholder="除主服务器外，滚动/多机时的其它目标（顺序即部署顺序）"
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
        <n-alert type="info" :show-icon="false" class="mb-3">
          选择「本机 Worker kubeconfig」时，部署会直接使用运行 Deploy Worker 的 Ubuntu 宿主机上的
          <n-text code>kubectl</n-text>
          与 kubeconfig，不需要登记集群，也不走 SSH。
        </n-alert>
        <n-form-item label="kubeconfig 来源">
          <n-select
            v-model:value="envForm.k8sKubeconfigSource"
            :options="k8sKubeconfigSourceOptions"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item v-if="envForm.k8sKubeconfigSource === 'registered'" label="登记集群" required>
          <n-select
            v-model:value="envForm.k8sClusterId"
            :options="k8sClusterOptions"
            :loading="loadingClusters"
            clearable
            filterable
            placeholder="请选择组织已登记的 Kubernetes 集群"
          />
        </n-form-item>
        <n-form-item v-if="envForm.k8sKubeconfigSource === 'local'" label="本机 kubeconfig 路径">
          <n-input
            v-model:value="envForm.k8sKubeconfigPath"
            placeholder="可选；留空使用 KUBECONFIG / ~/.kube/config"
          />
        </n-form-item>
        <n-form-item label="命名空间" required>
          <n-input
            v-model:value="envForm.k8sNamespace"
            placeholder="如 shipyard 或 default（须与集群实际 Namespace 一致）"
          />
        </n-form-item>
        <n-form-item label="主 Deployment 名称" required>
          <n-input
            v-model:value="envForm.k8sPrimaryDeploymentName"
            placeholder="如 shipyard-server（须与 kubectl get deploy 名称一致）"
          />
        </n-form-item>
        <n-form-item label="主容器名称" required>
          <n-input
            v-model:value="envForm.k8sPrimaryContainerName"
            placeholder="如 server（须与 Pod 模板 containers[].name 一致，通常不同于 Deployment 名）"
          />
        </n-form-item>
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
        <n-form-item label="同镜像额外 Deployment">
          <n-alert type="info" style="margin-bottom: 10px" :show-icon="false">
            与上方主 Deployment/主容器、以及发布配置中 JSON 的
            <n-text code>kubernetes</n-text>
            块共用同一流水线镜像；按列表顺序依次滚动（如先 server 再 worker）。每行容器名须与 Pod 模板一致。
          </n-alert>
          <n-space vertical style="width: 100%">
            <div
              v-for="(row, idx) in envForm.k8sAdditionalRollouts"
              :key="idx"
              style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; width: 100%"
            >
              <n-input
                v-model:value="row.deploymentName"
                placeholder="Deployment 名，如 shipyard-worker"
                style="min-width: 160px; flex: 1"
              />
              <n-input
                v-model:value="row.containerName"
                placeholder="容器名，如 worker"
                style="min-width: 120px; flex: 1"
              />
              <n-button size="small" @click="removeK8sAdditionalRow(idx)">移除</n-button>
            </div>
            <n-button size="small" secondary @click="addK8sAdditionalRow">+ 添加 Deployment</n-button>
          </n-space>
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

      <template v-if="envForm.strategy === 'canary' && (envForm.executor === 'ssh' || envForm.executor === 'local')">
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
  NAlert,
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
  { label: '本机', value: 'local' },
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

const k8sKubeconfigSourceOptions = [
  { label: '本机 Worker kubeconfig', value: 'local' },
  { label: '组织登记集群', value: 'registered' },
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
  executor: 'ssh' | 'local' | 'kubernetes' | 'object_storage';
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
  k8sKubeconfigSource: 'local' | 'registered';
  k8sClusterId: string | null;
  k8sKubeconfigPath: string;
  k8sNamespace: string;
  /** 主 Deployment / 容器名（写入 kubernetes.deploymentName / containerName） */
  k8sPrimaryDeploymentName: string;
  k8sPrimaryContainerName: string;
  /** K8s 中与主 Deployment 共用镜像的额外滚动目标（写入 releaseConfig.kubernetes.additionalDeployments） */
  k8sAdditionalRollouts: Array<{ deploymentName: string; containerName: string }>;
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
  k8sKubeconfigSource: 'local',
  k8sClusterId: null,
  k8sKubeconfigPath: '',
  k8sNamespace: '',
  k8sPrimaryDeploymentName: '',
  k8sPrimaryContainerName: '',
  k8sAdditionalRollouts: [],
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
  if (envForm.value.executor !== 'ssh') {
    envForm.value.extraServerIds = [];
  }
});

const submitting = ref(false);
const loadingBranches = ref(false);
const loadingClusters = ref(false);
const branchOptions = ref<Array<{ label: string; value: string }>>([]);
const serverOptions = ref<Array<{ label: string; value: string }>>([]);
const k8sClusterOptions = ref<Array<{ label: string; value: string }>>([]);

const extraServerOptions = computed(() =>
  serverOptions.value.filter((o) => o.value !== envForm.value.serverId),
);

/** 解析 kubernetes.additionalDeployments 供表单展示 */
function parseK8sAdditionalDeploymentsFromKube(
  k: Record<string, unknown>,
): Array<{ deploymentName: string; containerName: string }> {
  const raw = k.additionalDeployments;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ deploymentName: string; containerName: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const dn = typeof o.deploymentName === 'string' ? o.deploymentName.trim() : '';
    if (!dn) continue;
    const cn = typeof o.containerName === 'string' ? o.containerName.trim() : '';
    out.push({ deploymentName: dn, containerName: cn });
  }
  return out;
}

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
    k8sKubeconfigSource: 'local' as EnvFormState['k8sKubeconfigSource'],
    k8sClusterId: null as string | null,
    k8sKubeconfigPath: '',
    k8sNamespace: '',
    ossBucket: '',
    ossPrefix: '',
    ossRegion: '',
    k8sPrimaryDeploymentName: '',
    k8sPrimaryContainerName: '',
    k8sAdditionalRollouts: [] as EnvFormState['k8sAdditionalRollouts'],
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
        : o.executor === 'local'
          ? 'local'
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
  const k8sKubeconfigSource: EnvFormState['k8sKubeconfigSource'] =
    k.kubeconfigSource === 'local'
      ? 'local'
      : k.kubeconfigSource === 'registered' || typeof k.clusterId === 'string'
        ? 'registered'
        : 'local';
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
    k8sKubeconfigSource,
    k8sClusterId: typeof k.clusterId === 'string' ? k.clusterId : null,
    k8sKubeconfigPath: typeof k.kubeconfigPath === 'string' ? k.kubeconfigPath : '',
    k8sNamespace: typeof k.namespace === 'string' ? k.namespace.trim() : '',
    ossBucket: typeof os.bucket === 'string' ? os.bucket : '',
    ossPrefix: typeof os.prefix === 'string' ? os.prefix : '',
    ossRegion: typeof os.region === 'string' ? os.region : '',
    k8sPrimaryDeploymentName:
      typeof k.deploymentName === 'string' ? k.deploymentName.trim() : '',
    k8sPrimaryContainerName:
      typeof k.containerName === 'string' ? k.containerName.trim() : '',
    k8sAdditionalRollouts: parseK8sAdditionalDeploymentsFromKube(k),
  };
}

function addK8sAdditionalRow() {
  envForm.value.k8sAdditionalRollouts.push({ deploymentName: '', containerName: '' });
}

function removeK8sAdditionalRow(idx: number) {
  envForm.value.k8sAdditionalRollouts.splice(idx, 1);
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
      k8sKubeconfigSource: meta.k8sKubeconfigSource,
      k8sClusterId: meta.k8sClusterId,
      k8sKubeconfigPath: meta.k8sKubeconfigPath,
      k8sNamespace: meta.k8sNamespace,
      k8sPrimaryDeploymentName: meta.k8sPrimaryDeploymentName ?? '',
      k8sPrimaryContainerName: meta.k8sPrimaryContainerName ?? '',
      ossBucket: meta.ossBucket,
      ossPrefix: meta.ossPrefix,
      ossRegion: meta.ossRegion,
      k8sAdditionalRollouts: (meta.k8sAdditionalRollouts ?? []).map((r) => ({ ...r })),
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
    k8sKubeconfigSource: 'local',
    k8sClusterId: null,
    k8sKubeconfigPath: '',
    k8sNamespace: '',
    k8sPrimaryDeploymentName: '',
    k8sPrimaryContainerName: '',
    ossBucket: '',
    ossPrefix: '',
    ossRegion: '',
    k8sAdditionalRollouts: [],
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
  const [servers, branches, clusters] = await Promise.all([
    envApi.listServersForOrg().catch(() => []),
    envApi.listProjectBranches().catch(() => []),
    envApi.listKubernetesClusters().catch(() => []),
  ]);
  serverOptions.value = (servers ?? []).map((s) => ({
    label: `${s.name}（${serverOsLabel(s.os)}）`,
    value: s.id,
  }));
  branchOptions.value = (branches ?? []).map((b) => ({ label: b, value: b }));
  k8sClusterOptions.value = (clusters ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));
}

watch(
  () => [props.show, props.mode, props.initialEnv?.id] as const,
  async ([open]) => {
    if (!open) return;
    loadingBranches.value = true;
    loadingClusters.value = true;
    try {
      // 须先拉取服务器/分支选项，再写入表单；否则 NSelect 在 options 为空时绑定已有 value 可能抛错
      await ensureOptionsLoaded();
      resetFromInitial();
    } catch {
      serverOptions.value = [];
      branchOptions.value = [];
      k8sClusterOptions.value = [];
      resetFromInitial();
    } finally {
      loadingBranches.value = false;
      loadingClusters.value = false;
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

  if (executor === 'local') {
    delete out.kubernetes;
    delete out.objectStorage;
  }

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

  if (executor !== 'local') {
    delete out.objectStorage;
  }

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
    const pdn = envForm.value.k8sPrimaryDeploymentName.trim();
    const pcn = envForm.value.k8sPrimaryContainerName.trim();
    const ns = envForm.value.k8sNamespace.trim();
    const prevSource =
      prev.kubeconfigSource === 'local'
        ? 'local'
        : prev.kubeconfigSource === 'registered' || typeof prev.clusterId === 'string'
          ? 'registered'
          : null;
    const preserveJsonRegistered =
      envForm.value.k8sKubeconfigSource === 'local' &&
      !envForm.value.k8sKubeconfigPath.trim() &&
      !envForm.value.k8sClusterId &&
      prevSource === 'registered';
    const kubeconfigSource = preserveJsonRegistered ? 'registered' : envForm.value.k8sKubeconfigSource;
    prev.kubeconfigSource = kubeconfigSource;
    if (kubeconfigSource === 'local') {
      delete prev.clusterId;
      const kp = envForm.value.k8sKubeconfigPath.trim();
      if (kp) prev.kubeconfigPath = kp;
      else delete prev.kubeconfigPath;
    } else {
      delete prev.kubeconfigPath;
      const clusterId = envForm.value.k8sClusterId?.trim();
      if (clusterId) prev.clusterId = clusterId;
      else delete prev.clusterId;
    }
    if (ns) prev.namespace = ns;
    if (pdn) prev.deploymentName = pdn;
    if (pcn) prev.containerName = pcn;
    const k8sRows = envForm.value.k8sAdditionalRollouts.filter((r) => r.deploymentName.trim());
    if (k8sRows.length > 0) {
      prev.additionalDeployments = k8sRows.map((r) => {
        const deploymentName = r.deploymentName.trim();
        const containerName = r.containerName.trim();
        if (containerName) {
          return { deploymentName, containerName };
        }
        return { deploymentName };
      });
    } else {
      delete prev.additionalDeployments;
    }
    out.kubernetes = prev;
    delete out.ssh;
  } else {
    delete out.kubernetes;
  }

  if (executor === 'local' && out.ssh && typeof out.ssh === 'object' && out.ssh !== null) {
    const ssh = { ...(out.ssh as Record<string, unknown>) };
    delete ssh.targets;
    delete ssh.primaryServerId;
    out.ssh = ssh;
  }

  if (strategy === 'canary' && (executor === 'ssh' || executor === 'local')) {
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

  if (
    executor === 'local' &&
    out.ssh &&
    typeof out.ssh === 'object' &&
    out.ssh !== null &&
    Object.keys(out.ssh).length === 0
  ) {
    delete out.ssh;
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
  const requiresServer = envForm.value.executor === 'ssh';
  if (requiresServer && !envForm.value.serverId) {
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

  if (envForm.value.executor === 'kubernetes') {
    const v = rcParsed.value;
    if (v != null && typeof v === 'object') {
      const kube = (v as Record<string, unknown>).kubernetes;
      if (kube && typeof kube === 'object') {
        const ku = kube as Record<string, unknown>;
        const ns = typeof ku.namespace === 'string' ? ku.namespace.trim() : '';
        const dn = typeof ku.deploymentName === 'string' ? ku.deploymentName.trim() : '';
        const cn = typeof ku.containerName === 'string' ? ku.containerName.trim() : '';
        const source =
          ku.kubeconfigSource === 'local'
            ? 'local'
            : ku.kubeconfigSource === 'registered' || typeof ku.clusterId === 'string'
              ? 'registered'
              : 'local';
        if (!ns || !dn || !cn) {
          message.error(
            'Kubernetes 须填写命名空间、主 Deployment 名称与主容器名称（表单顶部三项，或在发布配置 JSON 的 kubernetes 中提供 namespace、deploymentName、containerName）',
          );
          return;
        }
        if (source === 'registered' && typeof ku.clusterId !== 'string') {
          message.error('Kubernetes 使用组织登记集群时请选择集群');
          return;
        }
      }
    }
  }

  submitting.value = true;
  try {
    const targets = requiresServer && envForm.value.serverId
      ? buildEnvironmentTargets(envForm.value.serverId)
      : [];
    const serverPayload = requiresServer
      ? { serverId: envForm.value.serverId, environmentTargets: targets }
      : { serverId: null, environmentTargets: [] };
    if (props.mode === 'edit') {
      if (!props.initialEnv?.id) throw new Error('missing env id');
      await envApi.updateEnvironment(props.initialEnv.id, {
        name,
        triggerBranch,
        ...serverPayload,
        deployPath,
        domain: envForm.value.domain.trim() ? envForm.value.domain.trim() : null,
        healthCheckUrl: envForm.value.healthCheckUrl.trim()
          ? envForm.value.healthCheckUrl.trim()
          : null,
        protected: envForm.value.protected,
        ...(rcParsed.value !== undefined ? { releaseConfig: rcParsed.value } : {}),
      });
      message.success('已保存');
    } else {
      await envApi.createEnvironment({
        name,
        triggerBranch,
        ...serverPayload,
        deployPath,
        domain: envForm.value.domain.trim() || undefined,
        healthCheckUrl: envForm.value.healthCheckUrl.trim() || undefined,
        protected: envForm.value.protected,
        ...(rcParsed.value !== undefined ? { releaseConfig: rcParsed.value } : {}),
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
