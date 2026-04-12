<template>
  <page-meta
    :background-text-style="pageMetaBgText"
    :background-color="pageMetaBg"
    :background-color-top="pageMetaBg"
    :root-background-color="pageMetaBg"
    :background-color-bottom="pageMetaBg"
  />
  <mp-theme-provider>
  <mp-custom-nav-bar />
  <view class="p-3 mp-tab-page--with-bottom-bar mp-page-column-fill">
    <OrgNavGrid v-if="orgSlug" scope="deployment" :org-slug="orgSlug" />
    <view class="flex justify-end mb-2">
      <wd-button size="small" type="primary" @click="openCreate">添加服务器</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <view v-else-if="servers.length">
      <view
        v-for="s in servers"
        :key="s.id"
        class="mb-2 p-3 rounded-lg bg-white border border-gray-200 flex justify-between items-center"
      >
        <view class="flex-1 mr-2">
          <text class="font-medium">{{ s.name }}</text>
          <text class="block text-xs text-gray-500 mt-1">{{ s.host }}:{{ s.port }} · {{ s.os }}</text>
        </view>
        <view class="flex flex-col gap-1 items-end">
          <wd-button size="small" plain @click="openEdit(s)">编辑</wd-button>
          <wd-button size="small" plain type="error" @click="confirmDelete(s)">删除</wd-button>
          <wd-button size="small" plain @click="testConn(s.id)">测试</wd-button>
        </view>
      </view>
    </view>
    <view v-else class="mp-page-column-fill__grow">
      <mp-page-empty variant="page" title="暂无服务器" />
    </view>

    <wd-popup v-model="showCreate" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <text class="font-medium">{{ editingId ? '编辑服务器' : '添加服务器' }}</text>
        <wd-input v-model="form.name" class="mt-2" label="名称" />
        <wd-input v-model="form.host" label="主机" />
        <wd-input v-model="form.port" label="端口" type="number" />
        <wd-input v-model="form.user" label="SSH 用户" />
        <wd-textarea
          v-model="form.privateKey"
          label="私钥"
          :placeholder="editingId ? '留空则不更新私钥' : '-----BEGIN OPENSSH PRIVATE KEY-----...'"
        />
        <wd-input v-model="form.os" label="系统" placeholder="linux / darwin" />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="submit">保存</wd-button>
        <wd-button block plain class="mt-2" @click="closeForm">取消</wd-button>
      </view>
    </wd-popup>
    <typed-destructive-confirm-host />
  </view>
  <mp-main-tab-bar :tab-index="1" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as serversApi from '@/package-org/api/servers';
import type { ServerItem } from '@/package-org/api/servers';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';
import TypedDestructiveConfirmHost from '@/components/TypedDestructiveConfirmHost.vue';
import { openTypedDestructiveMp } from '@/composables/typedDestructiveConfirmMp';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const loading = ref(false);
const servers = ref<ServerItem[]>([]);
const showCreate = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const form = ref({
  name: '',
  host: '',
  port: '22',
  user: 'root',
  privateKey: '',
  os: 'linux',
});

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

watch(
  orgSlug,
  async (s) => {
    if (!s) return;
    loading.value = true;
    try {
      servers.value = await serversApi.listServers(s);
    } catch {
      // 全局 request 已提示
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function openCreate() {
  editingId.value = null;
  form.value = { name: '', host: '', port: '22', user: 'root', privateKey: '', os: 'linux' };
  showCreate.value = true;
}

function closeForm() {
  showCreate.value = false;
  editingId.value = null;
  form.value = { name: '', host: '', port: '22', user: 'root', privateKey: '', os: 'linux' };
}

function openEdit(s: ServerItem) {
  editingId.value = s.id;
  form.value = {
    name: s.name,
    host: s.host,
    port: String(s.port),
    user: s.user,
    privateKey: '',
    os: s.os,
  };
  showCreate.value = true;
}

function confirmDelete(s: ServerItem) {
  openTypedDestructiveMp({
    title: '删除服务器？',
    description: `将删除「${s.name}」（${s.host}），已关联的环境将无法再使用该服务器。`,
    expected: s.name,
    expectedLabel: '服务器名称',
    positiveText: '删除',
    onConfirm: async () => {
      await serversApi.deleteServer(orgSlug.value, s.id);
      uni.showToast({ title: '已删除', icon: 'success' });
      servers.value = await serversApi.listServers(orgSlug.value);
    },
  });
}

async function submit() {
  const f = form.value;
  const port = Number(f.port);
  if (!f.name.trim() || !f.host.trim() || !f.user.trim()) {
    uni.showToast({ title: '请填写名称、主机与用户', icon: 'none' });
    return;
  }
  if (!editingId.value && !f.privateKey.trim()) {
    uni.showToast({ title: '新建时必须填写私钥', icon: 'none' });
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      const patch: Record<string, unknown> = {
        name: f.name.trim(),
        host: f.host.trim(),
        port: Number.isFinite(port) ? port : 22,
        user: f.user.trim(),
        os: f.os.trim() || 'linux',
      };
      if (f.privateKey.trim()) patch.privateKey = f.privateKey.trim();
      await serversApi.updateServer(orgSlug.value, editingId.value, patch);
      uni.showToast({ title: '已保存', icon: 'success' });
    } else {
      await serversApi.createServer(orgSlug.value, {
        name: f.name.trim(),
        host: f.host.trim(),
        port: Number.isFinite(port) ? port : 22,
        user: f.user.trim(),
        privateKey: f.privateKey.trim(),
        os: f.os.trim() || 'linux',
      });
      uni.showToast({ title: '已添加', icon: 'success' });
    }
    closeForm();
    servers.value = await serversApi.listServers(orgSlug.value);
  } catch {
    // 全局 request 已提示
  } finally {
    saving.value = false;
  }
}

async function testConn(id: string) {
  try {
    const r = await serversApi.testServer(orgSlug.value, id);
    uni.showToast({ title: r.success ? r.message : r.message, icon: r.success ? 'success' : 'none' });
  } catch {
    // 全局 request 已提示
  }
}
</script>
