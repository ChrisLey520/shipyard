<template>
  <div class="mx-auto w-full max-w-[640px] min-w-0 px-0 page-header-stack-sm">
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
          <div class="mb-3 flex flex-col gap-3 min-w-0 sm:flex-row sm:items-center sm:justify-between">
            <div class="font-600 shrink-0">选择一个已关联的 Git 账户</div>
            <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <n-button class="w-full sm:w-auto" size="small" :loading="loadingAccounts" @click="loadAccounts">刷新</n-button>
              <n-button class="w-full sm:w-auto" size="small" type="primary" @click="showAddAccount = true">关联 Git 账户</n-button>
            </div>
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
                <n-radio value="nodejs">Node.js 后端</n-radio>
              </n-radio-group>
            </n-form-item>
            <n-form-item>
              <n-checkbox v-model:checked="batchMode">同仓多应用批量创建</n-checkbox>
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
        <n-form v-if="!batchMode" :model="form" label-placement="top">
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
          <n-form-item label="Node.js 版本">
            <n-select v-model:value="form.nodeVersion" :options="nodeVersionOptions" placeholder="请选择 Node.js 版本" />
          </n-form-item>
          <n-form-item v-if="form.frameworkType !== 'static'" :label="form.frameworkType === 'nodejs' ? 'Node 入口文件' : 'SSR 入口文件'">
            <n-input
              v-model:value="form.ssrEntryPoint"
              :placeholder="form.frameworkType === 'nodejs' ? 'dist/main.js' : 'dist/index.js'"
            />
          </n-form-item>
          <n-form-item v-if="form.frameworkType !== 'static'" label="服务端口">
            <n-input-number v-model:value="form.servicePort" :min="1" :max="65535" />
          </n-form-item>
        </n-form>
        <div v-else class="flex flex-col gap-4">
          <n-alert type="info" :show-icon="false">
            适合同一个 monorepo 仓库一次创建多个项目，例如 `apps/web` 与 `apps/server`。
          </n-alert>
          <n-space>
            <n-button secondary @click="applyBatchPreset('web_server')">填充 Web + Server 模板</n-button>
            <n-button secondary @click="applyBatchPreset('web_nest')">填充 Web + NestJS 模板</n-button>
          </n-space>
          <n-card size="small" title="环境模板（可选）">
            <n-form :model="envTemplate" label-placement="top">
              <n-form-item>
                <n-checkbox v-model:checked="envTemplate.enabled">创建项目后自动生成默认环境</n-checkbox>
              </n-form-item>
              <template v-if="envTemplate.enabled">
                <n-form-item label="环境名称">
                  <n-input v-model:value="envTemplate.name" placeholder="production" />
                </n-form-item>
                <n-form-item label="触发分支">
                  <n-input v-model:value="envTemplate.triggerBranch" placeholder="main" />
                </n-form-item>
                <n-form-item label="执行器">
                  <n-select
                    v-model:value="envTemplate.executor"
                    :options="envTemplateExecutorOptions"
                    placeholder="选择部署执行器"
                  />
                </n-form-item>
                <n-form-item v-if="envTemplate.executor === 'ssh'" label="部署服务器">
                  <n-select
                    v-model:value="envTemplate.serverId"
                    :options="batchServerOptions"
                    :loading="loadingServers"
                    clearable
                    placeholder="请选择一台用于默认环境的服务器"
                  />
                </n-form-item>
                <n-alert v-if="envTemplate.executor === 'local'" type="info" :show-icon="false">
                  默认环境将部署到运行 Shipyard Worker 的本机，不走 SSH。
                </n-alert>
                <n-form-item label="部署根目录">
                  <n-input v-model:value="envTemplate.deployRoot" placeholder="/var/www/shipyard" />
                </n-form-item>
                <n-form-item label="基础域名（可选）">
                  <n-input v-model:value="envTemplate.baseDomain" placeholder="如 apps.example.com，将生成 {slug}.apps.example.com" />
                </n-form-item>
                <n-form-item label="受保护">
                  <n-switch v-model:value="envTemplate.protected" />
                </n-form-item>
              </template>
            </n-form>
          </n-card>
          <n-card v-for="(item, idx) in batchProjects" :key="idx" size="small" :title="`应用 ${idx + 1}`">
            <n-form :model="item" label-placement="top">
              <n-form-item label="项目名称">
                <n-input v-model:value="item.name" />
              </n-form-item>
              <n-form-item label="URL 标识">
                <n-input v-model:value="item.slug" placeholder="只能包含小写字母、数字和连字符" />
              </n-form-item>
              <n-form-item label="框架类型">
                <n-radio-group v-model:value="item.frameworkType">
                  <n-radio value="static">静态站点</n-radio>
                  <n-radio value="ssr">SSR（服务端渲染）</n-radio>
                  <n-radio value="nodejs">Node.js 后端</n-radio>
                </n-radio-group>
              </n-form-item>
              <n-form-item label="安装命令">
                <n-input v-model:value="item.installCommand" placeholder="pnpm install" />
              </n-form-item>
              <n-form-item label="构建命令">
                <n-input v-model:value="item.buildCommand" placeholder="pnpm build" />
              </n-form-item>
              <n-form-item label="工作目录">
                <n-input v-model:value="item.workingDirectory" placeholder="例如 apps/web 或 apps/server" />
              </n-form-item>
              <n-form-item label="输出目录">
                <n-input v-model:value="item.outputDir" placeholder="dist" />
              </n-form-item>
              <n-form-item label="Node.js 版本">
                <n-select v-model:value="item.nodeVersion" :options="nodeVersionOptions" />
              </n-form-item>
              <n-form-item v-if="item.frameworkType !== 'static'" :label="item.frameworkType === 'nodejs' ? 'Node 入口文件' : 'SSR 入口文件'">
                <n-input
                  v-model:value="item.ssrEntryPoint"
                  :placeholder="item.frameworkType === 'nodejs' ? 'dist/main.js' : 'dist/index.js'"
                />
              </n-form-item>
              <n-form-item v-if="item.frameworkType !== 'static'" label="服务端口">
                <n-input-number v-model:value="item.servicePort" :min="1" :max="65535" />
              </n-form-item>
            </n-form>
            <div class="mt-2 flex justify-end">
              <n-button v-if="batchProjects.length > 1" size="small" type="error" tertiary @click="removeBatchProject(idx)">
                移除应用
              </n-button>
            </div>
          </n-card>
          <div class="flex justify-start">
            <n-button secondary @click="addBatchProject">+ 添加应用</n-button>
          </div>
        </div>
        <n-space>
          <n-button @click="step = 1">上一步</n-button>
          <n-button type="primary" @click="handleCreate" :loading="creatingAny">创建项目</n-button>
        </n-space>
      </div>

      <n-modal
        v-model:show="showAddAccount"
        title="添加 Git 账户（PAT）"
        preset="card"
        style="width: min(100%, 620px)"
        :mask-closable="false"
        :close-on-esc="false"
      >
        <n-form :model="accountForm" label-placement="left" :label-width="160">
          <n-form-item label="账户名称">
            <n-input v-model:value="accountForm.name" placeholder="例如：my-github" />
          </n-form-item>
          <n-form-item label="Git Provider">
            <n-select v-model:value="accountForm.gitProvider" :options="gitProviderOptions" placeholder="请选择 Git Provider" />
          </n-form-item>
          <n-form-item v-if="gitProviderRequiresBaseUrl(accountForm.gitProvider)" label="Base URL">
            <n-input v-model:value="accountForm.baseUrl" :placeholder="baseUrlInputPlaceholder" />
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
  NInput, NInputNumber, NSelect, NRadioGroup, NRadio, NButton, NSpace, NModal, NEmpty, NThing, NTag, NSwitch, useMessage,
  NCheckbox, NAlert,
} from 'naive-ui';
import { useProjectCreationFlow, type GitAccountListItem } from '@/composables/projects/useProjectCreationFlow';
import { createEnvironment } from '@/api/projects/environments';
import { listServers, type ServerItem } from '@/api/servers';
import {
  DEFAULT_GITLAB_BASE_URL,
  GIT_PROVIDER_SELECT_OPTIONS,
  GitProvider,
  displayGitProviderBaseUrl,
  deriveRuntimeEntryPointForFramework,
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
const creatingBulk = creation.creatingProjectsBulk;
const creatingEnvironments = ref(false);
const creatingAny = computed(() => creating.value || creatingBulk.value || creatingEnvironments.value);
const loadingRepos = ref(false);
const loadingServers = ref(false);
const repoOptions = ref<Array<{ label: string; value: string }>>([]);
const loadingAccounts = ref(false);
const gitAccounts = ref<GitAccountListItem[]>([]);
const orgServers = ref<ServerItem[]>([]);

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

type ProjectCreateDraft = {
  name: string;
  slug: string;
  frameworkType: string;
  installCommand: string;
  buildCommand: string;
  workingDirectory: string;
  outputDir: string;
  nodeVersion: string;
  ssrEntryPoint: string;
  servicePort: number;
};

function createDraft(): ProjectCreateDraft {
  return {
    name: '',
    slug: '',
    frameworkType: 'static',
    installCommand: 'pnpm install',
    buildCommand: 'pnpm build',
    workingDirectory: '',
    outputDir: 'dist',
    nodeVersion: '20',
    ssrEntryPoint: '',
    servicePort: 3000,
  };
}

function createDraftFromPreset(
  kind: 'static' | 'nodejs',
  name: string,
  workingDirectory: string,
): ProjectCreateDraft {
  const normalizedName = name.trim();
  const isNode = kind === 'nodejs';
  const filterPath = workingDirectory.startsWith('.') ? workingDirectory : `./${workingDirectory}`;
  return {
    name: normalizedName,
    slug: slugifyFromDisplayName(normalizedName),
    frameworkType: kind,
    installCommand: 'pnpm install',
    buildCommand: `pnpm --filter ${filterPath} build`,
    workingDirectory,
    outputDir: 'dist',
    nodeVersion: '20',
    ssrEntryPoint: isNode ? 'dist/main.js' : '',
    servicePort: isNode ? 3000 : 3000,
  };
}

const batchMode = ref(false);
const batchProjects = ref<ProjectCreateDraft[]>([createDraft(), createDraft()]);

const form = ref({
  name: '',
  slug: '',
  frameworkType: 'static',
  repoFullName: null as string | null,
  gitAccountId: '',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  workingDirectory: '',
  outputDir: 'dist',
  nodeVersion: '20',
  ssrEntryPoint: '',
  servicePort: 3000,
});

const gitProviderOptions = GIT_PROVIDER_SELECT_OPTIONS;
const baseUrlInputPlaceholder = `${DEFAULT_GITLAB_BASE_URL} 或 https://gitea.yourdomain.com`;

const nodeVersionOptions = ['18', '20', '22'].map((v) => ({ label: `Node ${v}`, value: v }));
const envTemplateExecutorOptions = [
  { label: 'SSH', value: 'ssh' },
  { label: '本机', value: 'local' },
];
const batchServerOptions = computed(() =>
  orgServers.value.map((server) => ({
    label: `${server.name} (${server.host})`,
    value: server.id,
  })),
);

const envTemplate = ref({
  enabled: false,
  name: 'production',
  triggerBranch: 'main',
  executor: 'ssh' as 'ssh' | 'local',
  serverId: null as string | null,
  deployRoot: '/var/www/shipyard',
  baseDomain: '',
  protected: false,
});

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
  if (batchMode.value) {
    if (!form.value.repoFullName || !form.value.gitAccountId) return;
    if (envTemplate.value.enabled) {
      if (envTemplate.value.executor === 'ssh' && !envTemplate.value.serverId) {
        message.error('启用环境模板时请选择部署服务器');
        return;
      }
      if (!envTemplate.value.deployRoot.trim()) {
        message.error('启用环境模板时请填写部署根目录');
        return;
      }
    }
    const payload = batchProjects.value.map((item) => ({
      name: item.name.trim(),
      slug: item.slug.trim(),
      frameworkType: item.frameworkType,
      repoFullName: form.value.repoFullName ?? '',
      gitAccountId: form.value.gitAccountId,
      installCommand: item.installCommand.trim() || 'pnpm install',
      buildCommand: item.buildCommand.trim() || 'pnpm build',
      workingDirectory: item.workingDirectory.trim() || null,
      outputDir: item.outputDir.trim() || 'dist',
      nodeVersion: item.nodeVersion,
      ssrEntryPoint: item.frameworkType === 'static' ? null : item.ssrEntryPoint.trim() || null,
      servicePort: item.frameworkType === 'static' ? 3000 : item.servicePort,
    }));
    for (const item of batchProjects.value) {
      if (!item.name.trim() || !isValidUrlSlug(item.slug.trim())) {
        message.error('批量模式下请为每个应用填写合法的名称与 URL 标识');
        return;
      }
      if (item.workingDirectory.trim().startsWith('/') || item.workingDirectory.includes('..')) {
        message.error('工作目录必须是仓库内相对路径，且不能包含 ..');
        return;
      }
      if (
        item.frameworkType !== 'static' &&
        (!Number.isInteger(item.servicePort) || item.servicePort < 1 || item.servicePort > 65535)
      ) {
        message.error('服务端口须为 1-65535 的整数');
        return;
      }
    }
    try {
      const created = (await creation.createProjectsBulk({ projects: payload })) as Array<{
        slug: string;
        frameworkType: string;
      }>;
      if (envTemplate.value.enabled) {
        creatingEnvironments.value = true;
        const deployRoot = trimTrailingSlashes(envTemplate.value.deployRoot.trim());
        const baseDomain = normalizeBaseDomain(envTemplate.value.baseDomain);
        const envName = envTemplate.value.name.trim() || 'production';
        const branch = envTemplate.value.triggerBranch.trim() || 'main';
        const draftBySlug = new Map(batchProjects.value.map((item) => [item.slug.trim(), item]));
        const settled = await Promise.allSettled(
          created.map((project) =>
            createEnvironment(orgSlug.value, project.slug, {
              name: envName,
              triggerBranch: branch,
              serverId: envTemplate.value.executor === 'ssh' ? envTemplate.value.serverId : null,
              deployPath: `${deployRoot}/${project.slug}`,
              domain: baseDomain ? `${project.slug}.${baseDomain}` : undefined,
              healthCheckUrl: buildDefaultHealthCheckUrl(draftBySlug.get(project.slug), baseDomain),
              protected: envTemplate.value.protected,
              ...(envTemplate.value.executor === 'local'
                ? { releaseConfig: { executor: 'local', strategy: 'direct' }, environmentTargets: [] }
                : {}),
            }),
          ),
        );
        const failed = settled.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          message.warning(`已创建 ${created.length} 个项目，其中 ${created.length - failed} 个默认环境创建成功，${failed} 个失败`);
        } else {
          message.success(`已创建 ${created.length} 个项目，并生成默认环境`);
        }
      } else {
        message.success(`已创建 ${payload.length} 个项目`);
      }
      void router.push(`/orgs/${orgSlug.value}/projects`);
    } catch {
      /* 接口错误由全局 axios 拦截器提示 */
    } finally {
      creatingEnvironments.value = false;
    }
    return;
  }
  if (
    form.value.frameworkType !== 'static' &&
    (!Number.isInteger(form.value.servicePort) ||
      form.value.servicePort < 1 ||
      form.value.servicePort > 65535)
  ) {
    message.error('服务端口须为 1-65535 的整数');
    return;
  }
  if (form.value.workingDirectory.trim().startsWith('/') || form.value.workingDirectory.includes('..')) {
    message.error('工作目录必须是仓库内相对路径，且不能包含 ..');
    return;
  }
  try {
    await creation.createProject({
      ...form.value,
      repoFullName: form.value.repoFullName ?? '',
    });
    message.success('项目创建成功！');
    void router.push(`/orgs/${orgSlug.value}/projects/${form.value.slug}`);
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
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
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    loadingRepos.value = false;
  }
}

async function loadAccounts() {
  loadingAccounts.value = true;
  try {
    gitAccounts.value = await creation.loadGitAccounts();
  } catch {
    gitAccounts.value = [];
  } finally {
    loadingAccounts.value = false;
  }
}

async function loadServers() {
  loadingServers.value = true;
  try {
    orgServers.value = await listServers(orgSlug.value, { shipyard: { silent: true } });
  } catch {
    orgServers.value = [];
  } finally {
    loadingServers.value = false;
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
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    creatingAccount.value = false;
  }
}

watch(orgSlug, () => {
  void loadAccounts();
  void loadServers();
}, { immediate: true });

// 选择 Git 账户后自动拉取仓库列表（更符合直觉）
watch(
  () => form.value.gitAccountId,
  async (id, prev) => {
    if (!id || id === prev) return;
    await loadRepos();
  },
);

watch(
  () => form.value.frameworkType,
  (next, prev) => {
    if (!next || next === prev) return;
    form.value.ssrEntryPoint = deriveRuntimeEntryPointForFramework(
      next,
      form.value.ssrEntryPoint,
      prev,
    );
  },
);

watch(
  () => batchProjects.value.map((item) => item.frameworkType),
  (next, prev) => {
    next.forEach((frameworkType, index) => {
      const item = batchProjects.value[index];
      if (!item) return;
      item.ssrEntryPoint = deriveRuntimeEntryPointForFramework(
        frameworkType,
        item.ssrEntryPoint,
        prev?.[index],
      );
    });
  },
  { deep: true },
);

function addBatchProject() {
  batchProjects.value.push(createDraft());
}

function removeBatchProject(index: number) {
  batchProjects.value.splice(index, 1);
}

function applyBatchPreset(kind: 'web_server' | 'web_nest') {
  const baseName = form.value.name.trim() || 'Monorepo App';
  const webName = `${baseName} Web`;
  const apiName = kind === 'web_nest' ? `${baseName} Nest API` : `${baseName} Server`;
  batchProjects.value = [
    createDraftFromPreset('static', webName, 'apps/web'),
    createDraftFromPreset('nodejs', apiName, 'apps/server'),
  ];
}

function trimTrailingSlashes(input: string): string {
  return input.replace(/\/+$/, '');
}

function normalizeBaseDomain(input: string): string {
  return input.trim().replace(/^\.+/, '').replace(/\.+$/, '');
}

function inferDefaultHealthCheckPath(project: ProjectCreateDraft | undefined): string | null {
  if (!project || project.frameworkType !== 'nodejs') return null;
  const hint = [
    project.name,
    project.slug,
    project.workingDirectory,
    project.buildCommand,
  ]
    .join(' ')
    .toLowerCase();
  return /\bnest(js)?\b/.test(hint) ? '/healthz' : '/health';
}

function buildDefaultHealthCheckUrl(
  project: ProjectCreateDraft | undefined,
  baseDomain: string,
): string | undefined {
  const healthPath = inferDefaultHealthCheckPath(project);
  const slug = project?.slug.trim();
  if (!healthPath || !baseDomain || !slug) return undefined;
  return `http://${slug}.${baseDomain}${healthPath}`;
}
</script>
