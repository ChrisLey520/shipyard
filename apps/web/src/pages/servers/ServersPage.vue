<template>
  <div>
    <n-page-header title="服务器管理">
      <template #extra>
        <n-button type="primary" @click="showAdd = true">+ 添加服务器</n-button>
      </template>
    </n-page-header>

    <n-data-table
      :columns="columns"
      :data="servers"
      :loading="loading"
      style="margin-top: 16px"
    />

    <n-modal v-model:show="showAdd" title="添加服务器" preset="card" style="width: 520px">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item label="名称"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="Host/IP"><n-input v-model:value="form.host" /></n-form-item>
        <n-form-item label="SSH 端口"><n-input-number v-model:value="form.port" /></n-form-item>
        <n-form-item label="用户名"><n-input v-model:value="form.user" /></n-form-item>
        <n-form-item label="SSH 私钥">
          <n-input v-model:value="form.privateKey" type="textarea" :rows="6" placeholder="-----BEGIN..." />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAdd = false">取消</n-button>
          <n-button type="primary" :loading="adding" @click="handleAdd">添加</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  NPageHeader, NDataTable, NButton, NModal, NForm, NFormItem,
  NInput, NInputNumber, NSpace, useMessage, type DataTableColumns,
} from 'naive-ui';
import { createServer, deleteServer as apiDeleteServer, listServers, testServer, type ServerItem } from './api';

const route = useRoute();
const message = useMessage();
const orgSlug = route.params['orgSlug'] as string;
const servers = ref<ServerItem[]>([]);
const loading = ref(false);
const showAdd = ref(false);
const adding = ref(false);
const form = ref({ name: '', host: '', port: 22, user: 'root', privateKey: '' });

const columns: DataTableColumns<ServerItem> = [
  { title: '名称', key: 'name' },
  { title: 'Host', key: 'host' },
  { title: 'SSH 端口', key: 'port', width: 100 },
  { title: '用户', key: 'user' },
  {
    title: '操作', key: 'actions', width: 160,
    render: (row) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', onClick: () => testConn(row.id) }, { default: () => '连通测试' }),
      h(NButton, { size: 'small', type: 'error', onClick: () => deleteServer(row.id) }, { default: () => '删除' }),
    ]),
  },
];

async function testConn(serverId: string) {
  const result = await testServer(orgSlug, serverId);
  if (result.success) message.success(result.message);
  else message.error(result.message);
}

async function deleteServer(serverId: string) {
  await apiDeleteServer(orgSlug, serverId);
  message.success('已删除');
  await load();
}

async function handleAdd() {
  adding.value = true;
  try {
    await createServer(orgSlug, form.value);
    message.success('服务器已添加');
    showAdd.value = false;
    await load();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '添加失败');
  } finally {
    adding.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    servers.value = await listServers(orgSlug);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
