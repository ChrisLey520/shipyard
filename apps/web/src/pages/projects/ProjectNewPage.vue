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
        <div v-if="!loadingAccounts && gitAccounts.length === 0">
          <n-empty description="还没有关联任何 Git 账户">
            <template #extra>
              <n-space>
                <n-button :loading="loadingAccounts" @click="loadAccounts">刷新</n-button>
                <n-button type="primary" @click="showAddAccount = true">关联 Git 账户</n-button>
              </n-space>
            </template>
          </n-empty>
        </div>

        <div v-else-if="!form.gitAccountId">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div style="font-weight: 600">选择一个已关联的 Git 账户</div>
            <n-space>
              <n-button size="small" :loading="loadingAccounts" @click="loadAccounts">刷新</n-button>
              <n-button size="small" type="primary" @click="showAddAccount = true">关联 Git 账户</n-button>
            </n-space>
          </div>

          <n-space vertical size="small">
            <n-card
              v-for="acc in gitAccounts"
              :key="acc.id"
              size="small"
              hoverable
              style="cursor: pointer"
              @click="form.gitAccountId = acc.id"
            >
              <n-thing :title="acc.name">
                <template #description>
                  <n-space size="small">
                    <n-tag size="small">{{ gitProviderLabel(acc.gitProvider) }}</n-tag>
                    <span>账号：{{ acc.gitUsername || '-' }}</span>
                    <span>地址：{{ displayGitProviderBaseUrl(acc.gitProvider, acc.baseUrl) }}</span>
                  </n-space>
                </template>
              </n-thing>
            </n-card>
          </n-space>
        </div>

        <div v-else>
          <n-card size="small" style="margin-bottom: 12px">
            <n-thing :title="`已选择：${selectedAccount?.name ?? ''}`">
              <template #description>
                <n-space size="small">
                  <n-tag size="small">{{ gitProviderLabel(selectedAccount?.gitProvider ?? '') }}</n-tag>
                  <span>账号：{{ selectedAccount?.gitUsername || '-' }}</span>
                  <span>地址：{{
                    selectedAccount
                      ? displayGitProviderBaseUrl(selectedAccount.gitProvider, selectedAccount.baseUrl)
                      : '-'
                  }}</span>
                </n-space>
              </template>
              <template #action>
                <n-button size="tiny" @click="form.gitAccountId = ''">重新选择</n-button>
              </template>
            </n-thing>
          </n-card>

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
            <n-form-item label="仓库（自动拉取，可搜索）">
              <n-space vertical style="width: 100%">
                <n-button
                  size="small"
                  :loading="loadingRepos"
                  :disabled="!form.gitAccountId"
                  @click="loadRepos"
                >
                  拉取仓库列表
                </n-button>
                <n-select
                  v-model:value="form.repoFullName"
                  filterable
                  tag
                  clearable
                  :options="repoOptions"
                  placeholder="选择或输入 owner/repo"
                />
              </n-space>
            </n-form-item>
          </n-form>
          <n-button type="primary" @click="step = 2" :disabled="!canStep1">下一步</n-button>
        </div>
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
            <n-select v-model:value="form.nodeVersion" :options="nodeVersionOptions" placeholder="请选择 Node.js 版本" />
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

      <n-modal
        v-model:show="showAddAccount"
        title="添加 Git 账户（PAT）"
        preset="card"
        style="width: 560px"
        :mask-closable="false"
        :close-on-esc="false"
      >
        <n-form :model="accountForm" label-placement="left" label-width="110">
          <n-form-item label="账户名称">
            <n-input v-model:value="accountForm.name" placeholder="例如：my-github" />
          </n-form-item>
          <n-form-item label="Git Provider">
            <n-select v-model:value="accountForm.gitProvider" :options="gitProviderOptions" placeholder="请选择 Git Provider" />
          </n-form-item>
          <n-form-item v-if="gitProviderRequiresBaseUrl(accountForm.gitProvider)" label="Base URL">
            <n-input v-model:value="accountForm.baseUrl" placeholder="https://gitlab.com 或 https://gitea.yourdomain.com" />
          </n-form-item>
          <n-form-item label="PAT">
            <n-input v-model:value="accountForm.accessToken" type="password" placeholder="Personal Access Token" />
          </n-form-item>
          <n-form-item label="用户名（可选）">
            <n-input v-model:value="accountForm.gitUsername" placeholder="某些平台可选，用于 clone URL" />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button @click="showAddAccount = false">取消</n-button>
            <n-button type="primary" :loading="creatingAccount" @click="handleCreateAccount">保存</n-button>
          </n-space>
        </template>
      </n-modal>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NCard, NSteps, NStep, NForm, NFormItem,
  NInput, NSelect, NRadioGroup, NRadio, NButton, NSpace, NModal, NEmpty, NThing, NTag, useMessage,
} from 'naive-ui';
import { useProjectCreationFlow, type GitAccountListItem } from '@/composables/projects/useProjectCreationFlow';
import {
  DEFAULT_GITLAB_BASE_URL,
  GIT_PROVIDER_SELECT_OPTIONS,
  GitProvider,
  displayGitProviderBaseUrl,
  gitProviderLabel,
  gitProviderRequiresBaseUrl,
  isValidUrlSlug,
  slugifyFromDisplayName,
} from '@shipyard/shared';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const step = ref(1);

const creation = useProjectCreationFlow(orgSlug);
const creating = creation.creatingProject;
const loadingRepos = ref(false);
const repoOptions = ref<Array<{ label: string; value: string }>>([]);
const loadingAccounts = ref(false);
const gitAccounts = ref<GitAccountListItem[]>([]);

const selectedAccount = computed(() =>
  gitAccounts.value.find((a) => a.id === form.value.gitAccountId) ?? null,
);

const showAddAccount = ref(false);
const creatingAccount = ref(false);
const accountForm = ref({
  name: '',
  gitProvider: GitProvider.GITHUB,
  baseUrl: DEFAULT_GITLAB_BASE_URL,
  accessToken: '',
  gitUsername: '',
});

const form = ref({
  name: '',
  slug: '',
  frameworkType: 'static',
  repoFullName: null as string | null,
  gitAccountId: '',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  outputDir: 'dist',
  nodeVersion: '20',
  ssrEntryPoint: 'dist/index.js',
});

const gitProviderOptions = GIT_PROVIDER_SELECT_OPTIONS;

const nodeVersionOptions = ['18', '20', '22'].map((v) => ({ label: `Node ${v}`, value: v }));

const canStep1 = computed(
  () =>
    Boolean(form.value.name) &&
    isValidUrlSlug(form.value.slug) &&
    Boolean(form.value.repoFullName) &&
    Boolean(form.value.gitAccountId),
);

function autoSlug() {
  form.value.slug = slugifyFromDisplayName(form.value.name);
}

async function handleCreate() {
  try {
    await creation.createProject({
      ...form.value,
      repoFullName: form.value.repoFullName ?? '',
    });
    message.success('项目创建成功！');
    void router.push(`/orgs/${orgSlug.value}/projects/${form.value.slug}`);
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '创建失败');
  }
}

async function loadRepos() {
  if (!form.value.gitAccountId) return;
  // 切换账户后，先清空旧数据，避免误选
  form.value.repoFullName = null;
  repoOptions.value = [];
  loadingRepos.value = true;
  try {
    const repos = await creation.loadReposForAccount(form.value.gitAccountId);
    repoOptions.value = repos.map((r) => ({
      label: `${r.fullName}${r.private ? ' (private)' : ''}`,
      value: r.fullName,
    }));
    message.success(`已加载 ${repoOptions.value.length} 个仓库`);
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '仓库列表获取失败');
  } finally {
    loadingRepos.value = false;
  }
}

async function loadAccounts() {
  loadingAccounts.value = true;
  try {
    gitAccounts.value = await creation.loadGitAccounts();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(
      e?.response?.data?.message ??
        'Git 账户列表加载失败（若刚升级代码，请在服务端执行数据库迁移：pnpm --filter @shipyard/server db:migrate）',
    );
  } finally {
    loadingAccounts.value = false;
  }
}

async function handleCreateAccount() {
  if (!accountForm.value.name || !accountForm.value.accessToken) return;
  creatingAccount.value = true;
  try {
    const created = await creation.addGitAccount({
      name: accountForm.value.name,
      gitProvider: accountForm.value.gitProvider,
      baseUrl: gitProviderRequiresBaseUrl(accountForm.value.gitProvider)
        ? accountForm.value.baseUrl
        : undefined,
      accessToken: accountForm.value.accessToken,
      gitUsername: accountForm.value.gitUsername || undefined,
    });
    message.success('Git 账户已添加');
    showAddAccount.value = false;
    accountForm.value = {
      name: '',
      gitProvider: GitProvider.GITHUB,
      baseUrl: DEFAULT_GITLAB_BASE_URL,
      accessToken: '',
      gitUsername: '',
    };
    await loadAccounts();
    if (created?.id) {
      form.value.gitAccountId = created.id;
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '添加失败');
  } finally {
    creatingAccount.value = false;
  }
}

watch(orgSlug, () => {
  void loadAccounts();
}, { immediate: true });

// 选择 Git 账户后自动拉取仓库列表（更符合直觉）
watch(
  () => form.value.gitAccountId,
  async (id, prev) => {
    if (!id || id === prev) return;
    await loadRepos();
  },
);
</script>
