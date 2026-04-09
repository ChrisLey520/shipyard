<template>
  <div style="max-width: 640px">
    <n-page-header title="新建项目" @back="router.back()" />

    <n-card style="margin-top: 16px">
      <n-steps :current="step">
        <n-step title="Git 仓库" />
        <n-step title="构建配置" />
        <n-step title="部署环境" />
      </n-steps>

      <!-- Step 1: Git 仓库 -->
      <div v-if="step === 1" style="margin-top: 24px">
        <n-form :model="form" label-placement="top">
          <n-form-item label="项目名称">
            <n-input v-model:value="form.name" @input="autoSlug" />
          </n-form-item>
          <n-form-item label="URL 标识">
            <n-input v-model:value="form.slug" placeholder="只能包含小写字母、数字和连字符" />
          </n-form-item>
          <n-form-item label="框架类型">
            <n-radio-group v-model:value="form.frameworkType">
              <n-radio value="static">静态站点</n-radio>
              <n-radio value="ssr">SSR（服务端渲染）</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item label="Git Provider">
            <n-select v-model:value="form.gitProvider" :options="gitProviderOptions" />
          </n-form-item>
          <n-form-item label="仓库地址（格式：owner/repo）">
            <n-input v-model:value="form.repoFullName" placeholder="e.g. myorg/myapp" />
          </n-form-item>
          <n-form-item label="Personal Access Token (PAT)">
            <n-input v-model:value="form.accessToken" type="password" placeholder="GitHub PAT" />
          </n-form-item>
        </n-form>
        <n-button type="primary" @click="step = 2" :disabled="!canStep1">下一步</n-button>
      </div>

      <!-- Step 2: 构建配置 -->
      <div v-else-if="step === 2" style="margin-top: 24px">
        <n-form :model="form" label-placement="top">
          <n-form-item label="安装命令">
            <n-input v-model:value="form.installCommand" placeholder="pnpm install" />
          </n-form-item>
          <n-form-item label="构建命令">
            <n-input v-model:value="form.buildCommand" placeholder="pnpm build" />
          </n-form-item>
          <n-form-item label="输出目录">
            <n-input v-model:value="form.outputDir" placeholder="dist" />
          </n-form-item>
          <n-form-item label="Node.js 版本">
            <n-select v-model:value="form.nodeVersion" :options="nodeVersionOptions" />
          </n-form-item>
          <n-form-item v-if="form.frameworkType === 'ssr'" label="SSR 入口文件">
            <n-input v-model:value="form.ssrEntryPoint" placeholder="dist/index.js" />
          </n-form-item>
        </n-form>
        <n-space>
          <n-button @click="step = 1">上一步</n-button>
          <n-button type="primary" @click="handleCreate" :loading="creating">创建项目</n-button>
        </n-space>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NCard, NSteps, NStep, NForm, NFormItem,
  NInput, NSelect, NRadioGroup, NRadio, NButton, NSpace, useMessage,
} from 'naive-ui';
import { http } from '../../api/client';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgSlug = route.params['orgSlug'] as string;
const step = ref(1);
const creating = ref(false);

const form = ref({
  name: '',
  slug: '',
  frameworkType: 'static',
  gitProvider: 'github',
  repoFullName: '',
  accessToken: '',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  outputDir: 'dist',
  nodeVersion: '20',
  ssrEntryPoint: 'dist/index.js',
});

const gitProviderOptions = [
  { label: 'GitHub', value: 'github' },
  { label: 'GitLab', value: 'gitlab' },
  { label: 'Gitee', value: 'gitee' },
  { label: 'Gitea', value: 'gitea' },
];

const nodeVersionOptions = ['18', '20', '22'].map((v) => ({ label: `Node ${v}`, value: v }));

const canStep1 = computed(() =>
  form.value.name && form.value.slug && form.value.repoFullName && form.value.accessToken,
);

function autoSlug() {
  form.value.slug = form.value.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function handleCreate() {
  creating.value = true;
  try {
    await http.post(`/orgs/${orgSlug}/projects`, form.value);
    message.success('项目创建成功！');
    void router.push(`/orgs/${orgSlug}/projects/${form.value.slug}`);
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '创建失败');
  } finally {
    creating.value = false;
  }
}
</script>
