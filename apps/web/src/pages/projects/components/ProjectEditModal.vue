<template>
  <n-modal
    :show="show"
    title="编辑项目"
    preset="card"
    style="width: 620px"
    :mask-closable="false"
    :close-on-esc="false"
    @update:show="(v) => emit('update:show', v)"
  >
    <div class="max-h-[68vh] overflow-y-auto pr-1">
      <n-form :model="form" label-placement="left" label-width="118">
        <n-divider title-placement="left">基本信息</n-divider>
        <n-form-item label="项目名称">
          <n-input v-model:value="form.name" placeholder="请输入项目名称" />
        </n-form-item>
        <n-form-item label="URL 标识">
          <n-input v-model:value="form.slug" placeholder="只能包含小写字母、数字和连字符" />
        </n-form-item>
        <n-form-item label="框架类型">
          <n-select
            v-model:value="form.frameworkType"
            :options="frameworkOptions"
            placeholder="请选择框架类型"
          />
        </n-form-item>

        <n-divider title-placement="left">构建配置</n-divider>
        <n-form-item label="安装命令">
          <n-input v-model:value="form.installCommand" placeholder="pnpm install" />
        </n-form-item>
        <n-form-item label="构建命令">
          <n-input v-model:value="form.buildCommand" placeholder="pnpm build" />
        </n-form-item>
        <n-form-item label="输出目录">
          <n-input v-model:value="form.outputDir" placeholder="dist" />
        </n-form-item>
        <n-form-item label="Node 版本">
          <n-select v-model:value="form.nodeVersion" :options="nodeVersionOptions" />
        </n-form-item>
        <n-form-item v-if="form.frameworkType === 'ssr'" label="SSR 入口">
          <n-input v-model:value="form.ssrEntryPoint" placeholder="dist/index.js" />
        </n-form-item>
        <n-form-item v-if="form.frameworkType === 'ssr'" label="预览健康路径">
          <n-input v-model:value="form.previewHealthCheckPath" placeholder="/ 或 /health" />
          <n-text depth="3" style="display: block; margin-top: 6px; font-size: 12px">
            PR 预览 SSR 蓝绿切换前远端 curl 使用的路径；留空等同 /
          </n-text>
        </n-form-item>
        <n-form-item label="Lint 命令">
          <n-input v-model:value="form.lintCommand" placeholder="可选，如 pnpm lint" />
        </n-form-item>
        <n-form-item label="测试命令">
          <n-input v-model:value="form.testCommand" placeholder="可选，如 pnpm test" />
        </n-form-item>
        <n-form-item label="构建超时（秒）">
          <n-input-number v-model:value="form.timeoutSeconds" :min="60" :max="7200" :step="60" class="w-full" />
        </n-form-item>
        <n-form-item label="依赖缓存">
          <n-switch v-model:value="form.cacheEnabled" />
        </n-form-item>

        <n-divider title-placement="left">容器镜像（Kubernetes 部署）</n-divider>
        <n-form-item label="构建后推送镜像">
          <n-switch v-model:value="form.containerImageEnabled" />
        </n-form-item>
        <template v-if="form.containerImageEnabled">
          <n-form-item label="镜像名（无 tag）">
            <n-input v-model:value="form.containerImageName" placeholder="registry.example.com/org/app" />
          </n-form-item>
          <n-form-item label="Registry 用户">
            <n-input v-model:value="form.registryUsername" placeholder="可选" />
          </n-form-item>
          <n-form-item label="Registry 密码">
            <n-input v-model:value="form.registryPassword" type="password" placeholder="留空则保留已保存凭据" />
          </n-form-item>
          <n-text depth="3" style="display: block; margin-bottom: 12px; font-size: 12px">
            仓库根目录需有 Dockerfile；Worker 须可用 Docker。凭据加密存储，仅保存时发送非空密码。
          </n-text>
        </template>

        <n-divider title-placement="left">PR 预览（GitHub pull_request）</n-divider>
        <n-form-item label="启用 PR 预览">
          <n-switch v-model:value="form.previewEnabled" />
        </n-form-item>
        <template v-if="form.previewEnabled">
          <n-form-item label="预览服务器">
            <n-select
              v-model:value="form.previewServerId"
              :options="serverOptions ?? []"
              clearable
              placeholder="选择用于 SSH 部署预览的 Linux 服务器"
            />
          </n-form-item>
          <n-form-item>
            <template #label>
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; width: 100%">
                <span style="line-height: 1">预览父域</span>
                <n-popover trigger="hover" placement="top" :width="360">
                  <template #trigger>
                    <n-button size="tiny" secondary circle style="width: 18px; height: 18px; padding: 0">
                      <span style="font-size: 12px; line-height: 1">i</span>
                    </n-button>
                  </template>
                  <div style="font-size: 12px; line-height: 1.6">
                    访问地址形如 pr-编号-项目id前8位.该父域；需泛解析 *.父域 与 Nginx include（见 README）。
                  </div>
                </n-popover>
              </div>
            </template>
            <n-input v-model:value="form.previewBaseDomain" placeholder="如 preview.example.com" />
          </n-form-item>
        </template>
      </n-form>
    </div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="saving" @click="emit('save', snapshotForm())">保存</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NSpace,
  NButton,
  NDivider,
  NPopover,
  NText,
} from 'naive-ui';

export type ProjectEditFormValues = {
  name: string;
  slug: string;
  frameworkType: string;
  installCommand: string;
  buildCommand: string;
  lintCommand: string;
  testCommand: string;
  outputDir: string;
  nodeVersion: string;
  cacheEnabled: boolean;
  timeoutSeconds: number;
  ssrEntryPoint: string;
  /** PR 预览 SSR 健康检查 path，空则 / */
  previewHealthCheckPath: string;
  previewEnabled: boolean;
  previewServerId: string | null;
  previewBaseDomain: string;
  containerImageEnabled: boolean;
  containerImageName: string;
  registryUsername: string;
  registryPassword: string;
};

const props = defineProps<{
  show: boolean;
  saving: boolean;
  initial: ProjectEditFormValues;
  serverOptions?: { label: string; value: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'save', v: ProjectEditFormValues): void;
}>();

const frameworkOptions = [
  { label: '静态站点', value: 'static' },
  { label: 'SSR（服务端渲染）', value: 'ssr' },
];

const nodeVersionOptions = ['18', '20', '22'].map((v) => ({ label: `Node ${v}`, value: v }));

const form = reactive<ProjectEditFormValues>({
  name: '',
  slug: '',
  frameworkType: 'static',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  lintCommand: '',
  testCommand: '',
  outputDir: 'dist',
  nodeVersion: '20',
  cacheEnabled: true,
  timeoutSeconds: 900,
  ssrEntryPoint: 'dist/index.js',
  previewHealthCheckPath: '',
  previewEnabled: false,
  previewServerId: null,
  previewBaseDomain: '',
  containerImageEnabled: false,
  containerImageName: '',
  registryUsername: '',
  registryPassword: '',
});

function snapshotForm(): ProjectEditFormValues {
  return { ...form };
}

watch(
  () => props.initial,
  (v) => {
    if (!v) return;
    form.name = v.name ?? '';
    form.slug = v.slug ?? '';
    form.frameworkType = (v.frameworkType as 'static' | 'ssr') ?? 'static';
    form.installCommand = v.installCommand ?? 'pnpm install';
    form.buildCommand = v.buildCommand ?? 'pnpm build';
    form.lintCommand = v.lintCommand ?? '';
    form.testCommand = v.testCommand ?? '';
    form.outputDir = v.outputDir ?? 'dist';
    form.nodeVersion = v.nodeVersion ?? '20';
    form.cacheEnabled = v.cacheEnabled ?? true;
    form.timeoutSeconds = typeof v.timeoutSeconds === 'number' ? v.timeoutSeconds : 900;
    form.ssrEntryPoint = v.ssrEntryPoint ?? 'dist/index.js';
    form.previewHealthCheckPath = v.previewHealthCheckPath ?? '';
    form.previewEnabled = v.previewEnabled ?? false;
    form.previewServerId = v.previewServerId ?? null;
    form.previewBaseDomain = v.previewBaseDomain ?? '';
    form.containerImageEnabled = v.containerImageEnabled ?? false;
    form.containerImageName = v.containerImageName ?? '';
    form.registryUsername = v.registryUsername ?? '';
    form.registryPassword = '';
  },
  { immediate: true, deep: true },
);
</script>
