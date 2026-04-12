<template>
  <view class="p-3">
    <view class="flex justify-between items-center mb-3">
      <text class="text-sm font-medium">环境列表</text>
      <wd-button size="small" type="primary" @click="showCreate = true">新建</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <wd-cell-group v-else border>
      <wd-cell
        v-for="e in envs"
        :key="e.id"
        :title="e.name"
        :label="`${e.triggerBranch} · ${e.deployPath}`"
        is-link
        @click="openEdit(e)"
      />
    </wd-cell-group>
    <view v-if="!loading && !envs.length" class="text-center text-gray-500 py-8">暂无环境</view>

    <wd-popup v-model="showCreate" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <text class="font-medium">新建环境</text>
        <wd-input v-model="createForm.name" class="mt-2" label="名称" />
        <wd-input v-model="createForm.triggerBranch" label="触发分支" />
        <wd-input v-model="createForm.deployPath" label="部署路径" />
        <wd-input v-model="createForm.serverId" label="服务器 ID" />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="submitCreate">保存</wd-button>
        <wd-button block plain class="mt-2" @click="showCreate = false">取消</wd-button>
      </view>
    </wd-popup>

    <wd-popup v-model="showEdit" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <text class="font-medium">编辑环境</text>
        <wd-input v-model="editForm.name" class="mt-2" label="名称" />
        <wd-input v-model="editForm.triggerBranch" label="触发分支" />
        <wd-input v-model="editForm.deployPath" label="部署路径" />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="submitEdit">保存</wd-button>
        <wd-button block plain custom-class="mt-2" type="error" @click="submitDelete">删除</wd-button>
        <wd-button block plain class="mt-2" @click="showEdit = false">取消</wd-button>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useProjectPageContext } from '@/composables/useProjectPageContext';
import * as envApi from '@/api/environments';
import type { Env } from '@/api/environments';
import { HttpError } from '@/api/http';

const { orgSlug, projectSlug, initProjectFromQuery } = useProjectPageContext();
const loading = ref(false);
const envs = ref<Env[]>([]);
const showCreate = ref(false);
const showEdit = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);

const createForm = ref({
  name: '',
  triggerBranch: 'main',
  deployPath: '/var/www',
  serverId: '',
});

const editForm = ref({
  name: '',
  triggerBranch: '',
  deployPath: '',
});

onLoad((q) => {
  initProjectFromQuery(q as Record<string, string | undefined>);
});

async function load() {
  if (!orgSlug.value || !projectSlug.value) return;
  loading.value = true;
  try {
    envs.value = await envApi.listEnvironments(orgSlug.value, projectSlug.value);
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

watch([orgSlug, projectSlug], load, { immediate: true });

function openEdit(e: Env) {
  editingId.value = e.id;
  editForm.value = {
    name: e.name,
    triggerBranch: e.triggerBranch,
    deployPath: e.deployPath,
  };
  showEdit.value = true;
}

async function submitCreate() {
  const f = createForm.value;
  if (!f.name.trim() || !f.triggerBranch.trim() || !f.deployPath.trim() || !f.serverId.trim()) {
    uni.showToast({ title: '请填写名称、分支、路径与服务器 ID', icon: 'none' });
    return;
  }
  saving.value = true;
  try {
    await envApi.createEnvironment(orgSlug.value, projectSlug.value, {
      name: f.name.trim(),
      triggerBranch: f.triggerBranch.trim(),
      deployPath: f.deployPath.trim(),
      serverId: f.serverId.trim(),
    });
    uni.showToast({ title: '已创建', icon: 'success' });
    showCreate.value = false;
    createForm.value = { name: '', triggerBranch: 'main', deployPath: '/var/www', serverId: '' };
    await load();
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

async function submitEdit() {
  const id = editingId.value;
  if (!id) return;
  const f = editForm.value;
  saving.value = true;
  try {
    await envApi.updateEnvironment(orgSlug.value, projectSlug.value, id, {
      name: f.name.trim(),
      triggerBranch: f.triggerBranch.trim(),
      deployPath: f.deployPath.trim(),
    });
    uni.showToast({ title: '已保存', icon: 'success' });
    showEdit.value = false;
    await load();
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

function submitDelete() {
  const id = editingId.value;
  if (!id) return;
  uni.showModal({
    title: '删除环境',
    content: '确定删除该环境？',
    success: async (res) => {
      if (!res.confirm) return;
      saving.value = true;
      try {
        await envApi.deleteEnvironment(orgSlug.value, projectSlug.value, id);
        uni.showToast({ title: '已删除', icon: 'success' });
        showEdit.value = false;
        await load();
      } catch (e) {
        uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
      } finally {
        saving.value = false;
      }
    },
  });
}
</script>
