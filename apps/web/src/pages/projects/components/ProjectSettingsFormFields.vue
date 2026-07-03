<template>
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
    <n-form-item label="工作目录">
      <n-input v-model:value="form.workingDirectory" placeholder="留空为仓库根目录，例如 apps/web" />
    </n-form-item>
    <n-form-item label="输出目录">
      <n-input v-model:value="form.outputDir" placeholder="dist" />
    </n-form-item>
    <n-form-item label="Node 版本">
      <n-select v-model:value="form.nodeVersion" :options="nodeVersionOptions" />
    </n-form-item>
    <n-form-item v-if="form.frameworkType !== 'static'" :label="form.frameworkType === 'nodejs' ? 'Node 入口' : 'SSR 入口'">
      <n-input
        v-model:value="form.ssrEntryPoint"
        :placeholder="form.frameworkType === 'nodejs' ? 'dist/main.js' : 'dist/index.js'"
      />
    </n-form-item>
    <n-form-item v-if="form.frameworkType !== 'static'" label="容器监听端口">
      <n-space vertical class="w-full">
        <n-input-number v-model:value="form.servicePort" :min="1" :max="65535" :step="1" class="w-full" />
        <n-text depth="3" style="font-size: 12px">
          应用在容器/进程内实际监听的端口（默认 3000），会注入为 PORT 环境变量。入口网关从 80/443 反代到此端口，并非对外访问端口。
        </n-text>
      </n-space>
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
      <n-form-item label="Dockerfile 路径">
        <n-input
          v-model:value="form.containerDockerfilePath"
          placeholder="留空=根 Dockerfile；monorepo 子应用如 apps/web/Dockerfile"
        />
      </n-form-item>
      <n-form-item label="Registry 用户">
        <n-input v-model:value="form.registryUsername" placeholder="可选" />
      </n-form-item>
      <n-form-item label="Registry 密码">
        <n-input v-model:value="form.registryPassword" type="password" placeholder="留空则保留已保存凭据" />
      </n-form-item>
      <n-text depth="3" style="display: block; margin-bottom: 12px; font-size: 12px">
        构建上下文为仓库根；Dockerfile 路径留空用根 Dockerfile。Worker 须可用 Docker。凭据加密存储，仅保存时发送非空密码。
      </n-text>
    </template>

    <template v-if="showPrPreviewSection && form.frameworkType !== 'nodejs'">
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
    </template>
  </n-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NButton,
  NDivider,
  NPopover,
  NText,
  NSpace,
} from 'naive-ui';
import { deriveRuntimeEntryPointForFramework } from '@shipyard/shared';
import type { ProjectEditFormValues } from '../projectEditForm';

const props = defineProps<{
  form: ProjectEditFormValues;
  serverOptions?: { label: string; value: string }[];
  /** 仅 GitHub 等已支持 PR 预览的仓库展示 */
  showPrPreviewSection: boolean;
}>();

const frameworkOptions = [
  { label: '静态站点', value: 'static' },
  { label: 'SSR（服务端渲染）', value: 'ssr' },
  { label: 'Node.js 后端', value: 'nodejs' },
];

const nodeVersionOptions = ['18', '20', '22'].map((v) => ({ label: `Node ${v}`, value: v }));

watch(
  () => props.form.frameworkType,
  (next, prev) => {
    if (!next || next === prev) return;
    props.form.ssrEntryPoint = deriveRuntimeEntryPointForFramework(
      next,
      props.form.ssrEntryPoint,
      prev,
    );
  },
);
</script>
