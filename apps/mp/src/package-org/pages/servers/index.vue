<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <view class="flex justify-end mb-2">
      <wd-button size="small" type="primary" @click="showCreate = true">添加服务器</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <view v-else>
      <view
        v-for="s in servers"
        :key="s.id"
        class="mb-2 p-3 rounded-lg bg-white border border-gray-200 flex justify-between items-center"
      >
        <view class="flex-1 mr-2">
          <text class="font-medium">{{ s.name }}</text>
          <text class="block text-xs text-gray-500 mt-1">{{ s.host }}:{{ s.port }} · {{ s.os }}</text>
        </view>
        <wd-button size="small" plain @click="testConn(s.id)">测试</wd-button>
      </view>
    </view>
    <view v-if="!loading && !servers.length" class="text-center text-gray-500 py-8">暂无服务器</view>

    <wd-popup v-model="showCreate" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <wd-input v-model="form.name" label="名称" />
        <wd-input v-model="form.host" label="主机" />
        <wd-input v-model="form.port" label="端口" type="number" />
        <wd-input v-model="form.user" label="SSH 用户" />
        <wd-textarea v-model="form.privateKey" label="私钥" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." />
        <wd-input v-model="form.os" label="系统" placeholder="linux / darwin" />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="submit">保存</wd-button>
        <wd-button block plain class="mt-2" @click="showCreate = false">取消</wd-button>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as serversApi from '@/api/servers';
import type { ServerItem } from '@/api/servers';
import { HttpError } from '@/api/http';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const loading = ref(false);
const servers = ref<ServerItem[]>([]);
const showCreate = ref(false);
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
    } catch (e) {
      uni.showToast({ title: e instanceof HttpError ? e.message : '加载失败', icon: 'none' });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

async function submit() {
  const f = form.value;
  const port = Number(f.port);
  if (!f.name.trim() || !f.host.trim() || !f.user.trim() || !f.privateKey.trim()) {
    uni.showToast({ title: '请填写名称、主机、用户与私钥', icon: 'none' });
    return;
  }
  saving.value = true;
  try {
    await serversApi.createServer(orgSlug.value, {
      name: f.name.trim(),
      host: f.host.trim(),
      port: Number.isFinite(port) ? port : 22,
      user: f.user.trim(),
      privateKey: f.privateKey.trim(),
      os: f.os.trim() || 'linux',
    });
    uni.showToast({ title: '已添加', icon: 'success' });
    showCreate.value = false;
    form.value = { name: '', host: '', port: '22', user: 'root', privateKey: '', os: 'linux' };
    servers.value = await serversApi.listServers(orgSlug.value);
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

async function testConn(id: string) {
  try {
    const r = await serversApi.testServer(orgSlug.value, id);
    uni.showToast({ title: r.success ? r.message : r.message, icon: r.success ? 'success' : 'none' });
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '测试失败', icon: 'none' });
  }
}
</script>
