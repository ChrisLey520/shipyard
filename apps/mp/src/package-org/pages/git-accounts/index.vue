<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <view class="flex justify-end mb-2">
      <wd-button size="small" type="primary" @click="showCreate = true">添加账户</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <wd-cell-group v-else border>
      <wd-cell
        v-for="g in accounts"
        :key="g.id"
        :title="g.name"
        :label="`${g.gitProvider} · ${g.gitUsername ?? '-'}`"
        is-link
        @click="confirmDelete(g)"
      />
    </wd-cell-group>
    <view v-if="!loading && !accounts.length" class="text-center text-gray-500 py-8">暂无 Git 账户</view>

    <wd-popup v-model="showCreate" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <wd-input v-model="form.name" label="显示名" />
        <wd-input v-model="form.gitProvider" label="平台" placeholder="github / gitlab / gitea" />
        <wd-input v-model="form.baseUrl" label="Base URL" placeholder="可选，如自建 GitLab" />
        <wd-input v-model="form.gitUsername" label="用户名" placeholder="可选" />
        <wd-input v-model="form.accessToken" label="Access Token" show-password />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="submit">保存</wd-button>
        <wd-button block plain class="mt-2" @click="showCreate = false">取消</wd-button>
      </view>
    </wd-popup>
    <typed-destructive-confirm-host />
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as gitApi from '@/api/git-accounts';
import type { GitAccountItem } from '@/api/git-accounts';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';
import TypedDestructiveConfirmHost from '@/package-org/components/TypedDestructiveConfirmHost.vue';
import { openTypedDestructiveMp } from '@/package-org/composables/typedDestructiveConfirmMp';

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const loading = ref(false);
const accounts = ref<GitAccountItem[]>([]);
const showCreate = ref(false);
const saving = ref(false);
const form = ref({
  name: '',
  gitProvider: 'github',
  baseUrl: '',
  gitUsername: '',
  accessToken: '',
});

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

async function load() {
  if (!orgSlug.value) return;
  loading.value = true;
  try {
    accounts.value = await gitApi.listGitAccounts(orgSlug.value);
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

watch(orgSlug, load, { immediate: true });

async function submit() {
  if (!form.value.name.trim() || !form.value.gitProvider.trim() || !form.value.accessToken.trim()) {
    uni.showToast({ title: '请填写名称、平台与 Token', icon: 'none' });
    return;
  }
  saving.value = true;
  try {
    await gitApi.createGitAccount(orgSlug.value, {
      name: form.value.name.trim(),
      gitProvider: form.value.gitProvider.trim(),
      baseUrl: form.value.baseUrl.trim() || undefined,
      gitUsername: form.value.gitUsername.trim() || undefined,
      accessToken: form.value.accessToken,
    });
    uni.showToast({ title: '已添加', icon: 'success' });
    showCreate.value = false;
    form.value = { name: '', gitProvider: 'github', baseUrl: '', gitUsername: '', accessToken: '' };
    await load();
  } catch {
    // 全局 request 已提示
  } finally {
    saving.value = false;
  }
}

function confirmDelete(g: GitAccountItem) {
  openTypedDestructiveMp({
    title: '移除 Git 账户？',
    description: `将移除「${g.name}」，并无法再用于新建项目拉仓库。`,
    expected: g.name,
    expectedLabel: '账户名称',
    positiveText: '移除',
    onConfirm: async () => {
      await gitApi.deleteGitAccount(orgSlug.value, g.id);
      uni.showToast({ title: '已删除', icon: 'success' });
      await load();
    },
  });
}
</script>
