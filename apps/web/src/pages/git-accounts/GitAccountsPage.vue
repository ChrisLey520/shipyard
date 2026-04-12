<template>
  <div class="min-w-0">
    <n-page-header title="Git 账户" />

    <!-- 工具栏控件多：窄屏纵向堆叠，避免横向溢出 -->
    <n-card class="mt-4">
      <div class="flex flex-col gap-3 min-w-0 md:flex-row md:items-center md:justify-between">
        <div class="font-600 shrink-0">已关联账户</div>
        <div class="flex w-full flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:justify-end">
          <n-button class="w-full sm:w-auto" :loading="loading" @click="load">刷新</n-button>
          <div class="w-full sm:w-auto">
            <n-dropdown
              trigger="click"
              :options="oauthDropdownOptions"
              @select="(k: string) => oauthConnect(k)"
            >
              <n-button class="w-full sm:w-auto">OAuth 授权</n-button>
            </n-dropdown>
          </div>
          <n-button class="w-full sm:w-auto" type="primary" @click="openCreate">关联 Git 账户（PAT）</n-button>
        </div>
      </div>

      <div v-if="!loading && accounts.length === 0" class="mt-4">
        <n-empty description="暂无 Git 账户">
          <template #extra>
            <n-button type="primary" @click="openCreate">关联 Git 账户</n-button>
          </template>
        </n-empty>
      </div>

      <!-- 账户详情宽：大屏两列；中屏仍单列以免信息挤在一起 -->
      <n-grid v-else responsive="screen" cols="1 l:2" :x-gap="16" :y-gap="16" class="mt-4">
        <n-grid-item v-for="acc in accounts" :key="acc.id">
          <n-card size="small" hoverable>
            <div class="flex flex-col gap-3 min-w-0">
              <div class="text-base font-600 leading-snug break-words">{{ acc.name }}</div>
              <div class="flex flex-wrap gap-2 text-sm text-[var(--n-text-color-2)]">
                <n-tag size="small">{{ gitProviderLabel(acc.gitProvider) }}</n-tag>
                <n-tag v-if="acc.authType === 'oauth'" size="small" type="success">OAuth</n-tag>
                <n-tag v-else size="small" type="default">PAT</n-tag>
                <span class="break-all">账号：{{ acc.gitUsername || '-' }}</span>
                <span class="w-full break-all sm:w-auto">地址：{{ displayGitProviderBaseUrl(acc.gitProvider, acc.baseUrl) }}</span>
              </div>
              <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-end">
                <n-button class="w-full sm:w-auto" size="tiny" type="error" @click="confirmDelete(acc)">移除</n-button>
                <n-button
                  class="w-full sm:w-auto"
                  size="tiny"
                  :loading="testingId === acc.id"
                  @click="testRepos(acc)"
                >
                  连通测试
                </n-button>
                <n-button class="w-full sm:w-auto" size="tiny" @click="openEdit(acc)">编辑</n-button>
              </div>
            </div>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-card>

    <n-modal
      v-model:show="showModal"
      :title="editing ? '编辑 Git 账户' : '关联 Git 账户（PAT）'"
      preset="card"
      style="width: min(100%, 620px)"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-form :model="form" label-placement="left" :label-width="160">
        <n-form-item label="账户名称">
          <n-input v-model:value="form.name" placeholder="例如：my-github" />
        </n-form-item>
        <n-form-item label="Git Provider">
          <n-select v-model:value="form.gitProvider" :options="providerOptions" :disabled="Boolean(editing)" />
        </n-form-item>
        <n-form-item v-if="gitProviderRequiresBaseUrl(form.gitProvider)" label="Base URL">
          <n-input v-model:value="form.baseUrl" :placeholder="baseUrlInputPlaceholder" />
        </n-form-item>
        <n-form-item :label="editing ? 'PAT（可选更新）' : 'PAT'">
          <n-input v-model:value="form.accessToken" type="password" placeholder="Personal Access Token" />
        </n-form-item>
        <n-form-item label="用户名（可选）">
          <n-input v-model:value="form.gitUsername" placeholder="某些平台可选，用于 clone URL" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">
            {{ editing ? '保存' : '关联' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  NPageHeader,
  NCard,
  NButton,
  NSpace,
  NEmpty,
  NGrid,
  NGridItem,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDropdown,
  useMessage,
} from 'naive-ui';
import {
  useOrgGitAccountsActions,
  type GitAccountItem,
} from '@/composables/git-accounts/useOrgGitAccountsActions';
import {
  DEFAULT_GITLAB_BASE_URL,
  GIT_PROVIDER_OAUTH_DROPDOWN_OPTIONS,
  GIT_PROVIDER_SELECT_OPTIONS,
  GitProvider,
  displayGitProviderBaseUrl,
  gitProviderLabel,
  gitProviderRequiresBaseUrl,
} from '@shipyard/shared';
import { openDestructiveNameConfirm } from '@/ui/destructiveNameConfirm';

const route = useRoute();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const message = useMessage();
const gitApi = useOrgGitAccountsActions(orgSlug);

const loading = ref(false);
const accounts = ref<GitAccountItem[]>([]);

const showModal = ref(false);
const saving = ref(false);
const editing = ref<GitAccountItem | null>(null);
const testingId = ref<string | null>(null);

const providerOptions = GIT_PROVIDER_SELECT_OPTIONS;
const oauthDropdownOptions = GIT_PROVIDER_OAUTH_DROPDOWN_OPTIONS;
const baseUrlInputPlaceholder = `${DEFAULT_GITLAB_BASE_URL} 或 https://gitea.yourdomain.com`;

const form = ref({
  name: '',
  gitProvider: GitProvider.GITHUB,
  baseUrl: DEFAULT_GITLAB_BASE_URL,
  accessToken: '',
  gitUsername: '',
});

async function load() {
  loading.value = true;
  try {
    accounts.value = await gitApi.listGitAccounts();
  } catch {
    accounts.value = [];
  } finally {
    loading.value = false;
  }
}

async function oauthConnect(provider: string) {
  try {
    const url = await gitApi.startGitOAuth(provider);
    window.location.href = url;
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  }
}

function openCreate() {
  editing.value = null;
  form.value = {
    name: '',
    gitProvider: GitProvider.GITHUB,
    baseUrl: DEFAULT_GITLAB_BASE_URL,
    accessToken: '',
    gitUsername: '',
  };
  showModal.value = true;
}

function openEdit(acc: GitAccountItem) {
  editing.value = acc;
  form.value = {
    name: acc.name,
    gitProvider: acc.gitProvider as GitProvider,
    baseUrl: acc.baseUrl ?? (acc.gitProvider === GitProvider.GITLAB ? DEFAULT_GITLAB_BASE_URL : ''),
    accessToken: '',
    gitUsername: acc.gitUsername ?? '',
  };
  showModal.value = true;
}

async function save() {
  if (!form.value.name) return;
  if (!editing.value && !form.value.accessToken) return;

  saving.value = true;
  try {
    if (!editing.value) {
      await gitApi.createGitAccount({
        name: form.value.name,
        gitProvider: form.value.gitProvider,
        baseUrl: gitProviderRequiresBaseUrl(form.value.gitProvider) ? form.value.baseUrl : undefined,
        accessToken: form.value.accessToken,
        gitUsername: form.value.gitUsername || undefined,
      });
      message.success('已关联 Git 账户');
    } else {
      await gitApi.updateGitAccount(editing.value.id, {
        name: form.value.name,
        baseUrl: gitProviderRequiresBaseUrl(form.value.gitProvider) ? (form.value.baseUrl || null) : null,
        accessToken: form.value.accessToken || undefined,
        gitUsername: form.value.gitUsername || null,
      });
      message.success('已保存');
    }
    showModal.value = false;
    await load();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    saving.value = false;
  }
}

async function testRepos(acc: GitAccountItem) {
  testingId.value = acc.id;
  try {
    const repos = await gitApi.listReposForGitAccount(acc.id);
    message.success(`连通成功（可访问 ${repos.length} 个仓库）`);
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    testingId.value = null;
  }
}

function confirmDelete(acc: GitAccountItem) {
  openDestructiveNameConfirm({
    title: '移除 Git 账户？',
    description: `将移除「${acc.name}」，并无法再用于新建项目拉仓库。`,
    expected: acc.name,
    expectedLabel: '账户名称',
    positiveText: '移除',
    onConfirm: async () => {
      await gitApi.deleteGitAccount(acc.id);
      message.success('已移除');
      await load();
    },
  });
}

watch(orgSlug, () => {
  void load();
}, { immediate: true });

watch(
  () => route.query['oauth'],
  (q) => {
    if (q === 'success') {
      message.success('已通过 OAuth 关联 Git 账户');
      void load();
    }
  },
  { immediate: true },
);
</script>

