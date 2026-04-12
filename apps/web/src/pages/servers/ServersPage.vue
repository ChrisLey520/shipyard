<template>
  <div class="min-w-0 page-header-stack-sm">
    <n-page-header title="服务器管理">
      <template #extra>
        <n-button type="primary" @click="openAdd">+ 添加服务器</n-button>
      </template>
    </n-page-header>

    <n-data-table
      :columns="columns"
      :data="servers"
      :loading="loading"
      :scroll-x="960"
      style="margin-top: 16px"
    />

    <n-modal
      v-model:show="showAdd"
      :title="editingServerId ? '编辑服务器' : '添加服务器'"
      preset="card"
      style="width: min(100%, 580px)"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-form :model="form" label-placement="left" :label-width="140">
        <n-form-item label="名称"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="操作系统">
          <n-select v-model:value="form.os" :options="osOptions" placeholder="请选择操作系统" />
        </n-form-item>
        <n-form-item label="Host/IP"><n-input v-model:value="form.host" /></n-form-item>
        <n-form-item label="SSH 端口"><n-input-number v-model:value="form.port" /></n-form-item>
        <n-form-item label="用户名"><n-input v-model:value="form.user" /></n-form-item>
        <n-form-item label="SSH 私钥">
          <n-input v-model:value="form.privateKey" type="textarea" :rows="6" placeholder="-----BEGIN..." />
          <n-text depth="3" style="display:block;margin-top:6px;font-size:12px">
            编辑时不填私钥表示不更新
          </n-text>
        </n-form-item>
        <n-divider title-placement="left">PR 预览端口池（可选）</n-divider>
        <n-form-item label="端口下限">
          <n-input-number v-model:value="form.previewPortMin" :min="1024" :max="65535" clearable class="w-full" placeholder="默认 40000" />
        </n-form-item>
        <n-form-item label="端口上限">
          <n-input-number v-model:value="form.previewPortMax" :min="1024" :max="65535" clearable class="w-full" placeholder="默认 41000" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAdd = false">取消</n-button>
          <n-button type="primary" :loading="adding" @click="handleSave">
            {{ editingServerId ? '保存' : '添加' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, watch } from 'vue';
import ServersRowActionsCell from '@/components/table/ServersRowActionsCell.vue';
import { useRoute } from 'vue-router';
import {
  NPageHeader, NDataTable, NButton, NModal, NForm, NFormItem,
  NInput, NInputNumber, NSelect, NSpace, NText, NDivider, useMessage, type DataTableColumns,
} from 'naive-ui';
import { ServerOs, SERVER_OS_LABELS, isServerOs, serverOsLabel } from '@shipyard/shared';
import { useOrgServersActions, type ServerItem } from '@/composables/servers/useOrgServersActions';
import { openDestructiveNameConfirm } from '@/ui/destructiveNameConfirm';

const route = useRoute();
const message = useMessage();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const serversApi = useOrgServersActions(orgSlug);
const servers = ref<ServerItem[]>([]);
const loading = ref(false);
const showAdd = ref(false);
const adding = ref(false);
const editingServerId = ref<string | null>(null);
const form = ref({
  name: '',
  os: ServerOs.LINUX,
  host: '',
  port: 22,
  user: 'root',
  privateKey: '',
  previewPortMin: null as number | null,
  previewPortMax: null as number | null,
});

const osOptions = computed(() =>
  (Object.values(ServerOs) as ServerOs[]).map((value) => ({
    label: SERVER_OS_LABELS[value],
    value,
  })),
);

const columns: DataTableColumns<ServerItem> = [
  { title: '名称', key: 'name' },
  { title: '系统', key: 'os', width: 88, render: (row) => serverOsLabel(row.os) },
  { title: 'Host', key: 'host' },
  { title: 'SSH 端口', key: 'port', width: 100 },
  { title: '用户', key: 'user' },
  {
    title: '操作', key: 'actions', width: 220,
    render: (row) =>
      h(ServersRowActionsCell, {
        onEdit: () => void openEdit(row),
        onTest: () => void testConn(row.id),
        onDelete: () => void confirmRemoveServer(row),
      }),
  },
];

async function testConn(serverId: string) {
  const result = await serversApi.testServer(serverId);
  if (result.success) message.success(result.message);
  else message.error(result.message);
}

function confirmRemoveServer(row: ServerItem) {
  openDestructiveNameConfirm({
    title: '删除服务器？',
    description: `将删除「${row.name}」（${row.host}），已关联的环境将无法再使用该服务器。`,
    expected: row.name,
    expectedLabel: '服务器名称',
    positiveText: '删除',
    onConfirm: async () => {
      await serversApi.deleteServer(row.id);
      message.success('已删除');
      await load();
    },
  });
}

function openAdd() {
  editingServerId.value = null;
  form.value = {
    name: '',
    os: ServerOs.LINUX,
    host: '',
    port: 22,
    user: 'root',
    privateKey: '',
    previewPortMin: null,
    previewPortMax: null,
  };
  showAdd.value = true;
}

function openEdit(row: ServerItem) {
  editingServerId.value = row.id;
  const os = isServerOs(row.os) ? row.os : ServerOs.LINUX;
  form.value = {
    name: row.name,
    os,
    host: row.host,
    port: row.port,
    user: row.user,
    privateKey: '',
    previewPortMin: row.previewPortMin ?? null,
    previewPortMax: row.previewPortMax ?? null,
  };
  showAdd.value = true;
}

async function handleSave() {
  adding.value = true;
  try {
    if (editingServerId.value) {
      await serversApi.updateServer(editingServerId.value, {
        name: form.value.name,
        os: form.value.os,
        host: form.value.host,
        port: form.value.port,
        user: form.value.user,
        ...(form.value.privateKey ? { privateKey: form.value.privateKey } : {}),
        previewPortMin: form.value.previewPortMin,
        previewPortMax: form.value.previewPortMax,
      });
      message.success('服务器已更新');
    } else {
      await serversApi.createServer(form.value);
      message.success('服务器已添加');
    }
    showAdd.value = false;
    await load();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    adding.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    servers.value = await serversApi.listServers();
  } catch {
    servers.value = [];
  } finally {
    loading.value = false;
  }
}

watch(orgSlug, () => {
  void load();
}, { immediate: true });
</script>
