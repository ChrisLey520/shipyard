<template>
  <n-modal
    v-model:show="showProxy"
    :title="modalTitle"
    preset="card"
    style="width: 540px"
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

      <n-form-item label="发布配置 (JSON)" :show-feedback="false">
        <n-input
          v-model:value="envForm.releaseConfigJson"
          type="textarea"
          placeholder='{"executor":"ssh","strategy":"direct"}'
          :rows="6"
          :autosize="{ minRows: 4, maxRows: 14 }"
        />
        <div style="font-size: 12px; color: var(--n-text-color-3); margin-top: 6px; line-height: 1.5">
          可选。缺省与留空等价于 <n-text code>ssh</n-text> + <n-text code>direct</n-text>。Kubernetes 须先在组织下登记集群（API）。
        </div>
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
  useMessage,
} from 'naive-ui';
import { serverOsLabel } from '@shipyard/shared';
import {
  useEnvironmentsProjectActions,
  type Env,
} from '@/composables/environments/useEnvironmentsProjectActions';

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
  releaseConfigJson: '',
});

const submitting = ref(false);
const loadingBranches = ref(false);
const branchOptions = ref<Array<{ label: string; value: string }>>([]);
const serverOptions = ref<Array<{ label: string; value: string }>>([]);

const extraServerOptions = computed(() =>
  serverOptions.value.filter((o) => o.value !== envForm.value.serverId),
);

function resetFromInitial() {
  const e = props.initialEnv;
  if (props.mode === 'edit' && e) {
    const targets = e.environmentServers?.length
      ? [...e.environmentServers].sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    const primaryId = e.server?.id ?? targets[0]?.serverId ?? null;
    const extras = targets.map((t) => t.serverId).filter((id) => id !== primaryId);
    envForm.value = {
      name: e.name,
      triggerBranch: e.triggerBranch,
      serverId: primaryId,
      deployPath: e.deployPath,
      domain: e.domain ?? '',
      healthCheckUrl: e.healthCheckUrl ?? '',
      protected: e.protected,
      extraServerIds: extras,
      releaseConfigJson:
        e.releaseConfig != null ? JSON.stringify(e.releaseConfig, null, 2) : '',
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
    releaseConfigJson: '',
  };
}

async function ensureOptionsLoaded() {
  const [servers, branches] = await Promise.all([
    envApi.listServersForOrg(),
    envApi.listProjectBranches().catch(() => [] as string[]),
  ]);
  serverOptions.value = servers.map((s) => ({
    label: `${s.name}（${serverOsLabel(s.os)}）`,
    value: s.id,
  }));
  branchOptions.value = branches.map((b) => ({ label: b, value: b }));
}

watch(
  () => [props.show, props.mode, props.initialEnv?.id] as const,
  async ([open]) => {
    if (!open) return;
    resetFromInitial();
    loadingBranches.value = true;
    try {
      await ensureOptionsLoaded();
    } finally {
      loadingBranches.value = false;
    }
  },
);

/** 编辑时清空文本表示将 releaseConfig 置空；新建时留空表示不传 */
function parseReleaseConfigField():
  | { ok: true; value: unknown | undefined | null }
  | { ok: false } {
  const rawTrim = envForm.value.releaseConfigJson.trim();
  if (!rawTrim) {
    if (props.mode === 'edit' && props.initialEnv?.releaseConfig != null) {
      return { ok: true, value: null };
    }
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(rawTrim) as unknown };
  } catch {
    message.error('发布配置 JSON 无法解析');
    return { ok: false };
  }
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

  const rcParsed = parseReleaseConfigField();
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
    message.error(props.mode === 'edit' ? '保存失败' : '创建失败');
  } finally {
    submitting.value = false;
  }
}
</script>
