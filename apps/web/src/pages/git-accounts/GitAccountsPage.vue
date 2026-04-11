<template>
  <div>
    <n-page-header title="Git 账户" />

    <n-card style="margin-top: 16px">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <div style="font-weight: 600">已关联账户</div>
        <n-space>
          <n-button :loading="loading" @click="load">刷新</n-button>
          <n-dropdown
            trigger="click"
            :options="oauthDropdownOptions"
            @select="(k: string) => oauthConnect(k)"
          >
            <n-button>OAuth 授权</n-button>
          </n-dropdown>
          <n-button type="primary" @click="openCreate">关联 Git 账户（PAT）</n-button>
        </n-space>
      </div>

      <div v-if="!loading && accounts.length === 0" style="margin-top: 16px">
        <n-empty description="暂无 Git 账户">
          <template #extra>
            <n-button type="primary" @click="openCreate">关联 Git 账户</n-button>
          </template>
        </n-empty>
      </div>

      <n-grid v-else :cols="2" :x-gap="16" :y-gap="16" style="margin-top: 16px">
        <n-grid-item v-for="acc in accounts" :key="acc.id">
          <n-card size="small" hoverable>
            <n-thing :title="acc.name">
              <template #description>
                <n-space size="small" style="flex-wrap: wrap">
                  <n-tag size="small">{{ providerLabel(acc.gitProvider) }}</n-tag>
                  <n-tag v-if="acc.authType === 'oauth'" size="small" type="success">OAuth</n-tag>
                  <n-tag v-else size="small" type="default">PAT</n-tag>
                  <span>账号：{{ acc.gitUsername || '-' }}</span>
                  <span>地址：{{ providerBaseUrl(acc) }}</span>
                </n-space>
              </template>
              <template #action>
                <n-space>
                  <n-button size="tiny" @click="openEdit(acc)">编辑</n-button>
                  <n-button size="tiny" :loading="testingId === acc.id" @click="testRepos(acc)">
                    连通测试
                  </n-button>
                  <n-button size="tiny" type="error" @click="confirmDelete(acc)">移除</n-button>
                </n-space>
              </template>
            </n-thing>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-card>

    <n-modal
      v-model:show="showModal"
      :title="editing ? '编辑 Git 账户' : '关联 Git 账户（PAT）'"
      preset="card"
      style="width: 560px"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-form :model="form" label-placement="left" label-width="110">
        <n-form-item label="账户名称">
          <n-input v-model:value="form.name" placeholder="例如：my-github" />
        </n-form-item>
        <n-form-item label="Git Provider">
          <n-select v-model:value="form.gitProvider" :options="providerOptions" :disabled="Boolean(editing)" />
        </n-form-item>
        <n-form-item v-if="form.gitProvider === 'gitlab' || form.gitProvider === 'gitea'" label="Base URL">
          <n-input v-model:value="form.baseUrl" placeholder="https://gitlab.com 或 https://gitea.yourdomain.com" />
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
  NThing,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDropdown,
  useMessage,
  useDialog,
} from 'naive-ui';
import {
  useOrgGitAccountsActions,
  type GitAccountItem,
} from '@/composables/git-accounts/useOrgGitAccountsActions';

const route = useRoute();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const message = useMessage();
const dialog = useDialog();
const gitApi = useOrgGitAccountsActions(orgSlug);

const loading = ref(false);
const accounts = ref<GitAccountItem[]>([]);

const showModal = ref(false);
const saving = ref(false);
const editing = ref<GitAccountItem | null>(null);
const testingId = ref<string | null>(null);

const providerOptions = [
  { label: 'GitHub', value: 'github' },
  { label: 'GitLab', value: 'gitlab' },
  { label: 'Gitee', value: 'gitee' },
  { label: 'Gitea', value: 'gitea' },
];

const oauthDropdownOptions = [
  { label: 'GitHub OAuth', key: 'github' },
  { label: 'GitLab OAuth', key: 'gitlab' },
  { label: 'Gitee OAuth', key: 'gitee' },
  { label: 'Gitea OAuth', key: 'gitea' },
];

const form = ref({
  name: '',
  gitProvider: 'github',
  baseUrl: 'https://gitlab.com',
  accessToken: '',
  gitUsername: '',
});

function providerLabel(p: string) {
  const found = providerOptions.find((x) => x.value === p);
  return found?.label ?? p;
}

function providerBaseUrl(a: GitAccountItem) {
  if (a.baseUrl) return a.baseUrl;
  if (a.gitProvider === 'github') return 'https://github.com';
  if (a.gitProvider === 'gitlab') return 'https://gitlab.com';
  if (a.gitProvider === 'gitee') return 'https://gitee.com';
  return '-';
}

async function load() {
  loading.value = true;
  try {
    accounts.value = await gitApi.listGitAccounts();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(
      e?.response?.data?.message ??
        '加载失败。若刚升级过代码，请在服务器执行：pnpm --filter @shipyard/server db:migrate',
    );
  } finally {
    loading.value = false;
  }
}

async function oauthConnect(provider: string) {
  try {
    const url = await gitApi.startGitOAuth(provider);
    window.location.href = url;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '无法发起 OAuth（请检查服务端环境变量与回调地址）');
  }
}

function openCreate() {
  editing.value = null;
  form.value = { name: '', gitProvider: 'github', baseUrl: 'https://gitlab.com', accessToken: '', gitUsername: '' };
  showModal.value = true;
}

function openEdit(acc: GitAccountItem) {
  editing.value = acc;
  form.value = {
    name: acc.name,
    gitProvider: acc.gitProvider,
    baseUrl: acc.baseUrl ?? (acc.gitProvider === 'gitlab' ? 'https://gitlab.com' : ''),
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
        baseUrl:
          form.value.gitProvider === 'gitlab' || form.value.gitProvider === 'gitea'
            ? form.value.baseUrl
            : undefined,
        accessToken: form.value.accessToken,
        gitUsername: form.value.gitUsername || undefined,
      });
      message.success('已关联 Git 账户');
    } else {
      await gitApi.updateGitAccount(editing.value.id, {
        name: form.value.name,
        baseUrl:
          form.value.gitProvider === 'gitlab' || form.value.gitProvider === 'gitea'
            ? (form.value.baseUrl || null)
            : null,
        accessToken: form.value.accessToken || undefined,
        gitUsername: form.value.gitUsername || null,
      });
      message.success('已保存');
    }
    showModal.value = false;
    await load();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '操作失败');
  } finally {
    saving.value = false;
  }
}

async function testRepos(acc: GitAccountItem) {
  testingId.value = acc.id;
  try {
    const repos = await gitApi.listReposForGitAccount(acc.id);
    message.success(`连通成功（可访问 ${repos.length} 个仓库）`);
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '连通测试失败');
  } finally {
    testingId.value = null;
  }
}

function confirmDelete(acc: GitAccountItem) {
  dialog.warning({
    title: '确认移除 Git 账户？',
    content: `将移除「${acc.name}」，并无法再用于新建项目拉仓库。`,
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
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

