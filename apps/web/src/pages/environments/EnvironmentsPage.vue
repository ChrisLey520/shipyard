<template>
  <div>
    <n-page-header title="环境管理" @back="router.back()">
      <template #extra>
        <n-button type="primary" @click="showAdd = true">+ 新建环境</n-button>
      </template>
    </n-page-header>

    <n-list style="margin-top: 16px">
      <n-list-item v-for="env in envs" :key="env.id">
        <n-thing :title="env.name">
          <template #description>
            触发分支：{{ env.triggerBranch }} ·
            部署路径：{{ env.deployPath }} ·
            <n-tag size="small" :type="env.protected ? 'error' : 'default'">
              {{ env.protected ? '受保护' : '开放' }}
            </n-tag>
          </template>
          <template #action>
            <n-space>
              <n-button size="small" @click="openVarModal(env)">管理变量</n-button>
              <n-button size="small" type="error" @click="deleteEnv(env.id)">删除</n-button>
            </n-space>
          </template>
        </n-thing>
      </n-list-item>
    </n-list>

    <!-- 新建环境 -->
    <n-modal v-model:show="showAdd" title="新建环境" preset="card" style="width: 540px">
      <n-form :model="envForm" label-placement="left" label-width="100">
        <n-form-item label="环境名称"><n-input v-model:value="envForm.name" /></n-form-item>
        <n-form-item label="触发分支"><n-input v-model:value="envForm.triggerBranch" placeholder="main" /></n-form-item>
        <n-form-item label="服务器">
          <n-select v-model:value="envForm.serverId" :options="serverOptions" />
        </n-form-item>
        <n-form-item label="部署路径"><n-input v-model:value="envForm.deployPath" placeholder="/var/www/myapp" /></n-form-item>
        <n-form-item label="域名"><n-input v-model:value="envForm.domain" placeholder="myapp.com" /></n-form-item>
        <n-form-item label="健康检查 URL"><n-input v-model:value="envForm.healthCheckUrl" placeholder="https://myapp.com/health" /></n-form-item>
        <n-form-item label="受保护">
          <n-switch v-model:value="envForm.protected" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAdd = false">取消</n-button>
          <n-button type="primary" :loading="adding" @click="handleAddEnv">创建</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 环境变量管理 -->
    <n-modal v-model:show="showVarModal" :title="`${selectedEnv?.name} - 环境变量`" preset="card" style="width: 600px">
      <n-data-table :columns="varColumns" :data="envVars" size="small" />
      <div style="margin-top: 12px; display: flex; gap: 8px">
        <n-input v-model:value="newVar.key" placeholder="KEY" style="width: 180px" />
        <n-input v-model:value="newVar.value" type="password" placeholder="value" style="flex:1" />
        <n-button type="primary" @click="addVar">添加</n-button>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NList, NListItem, NThing, NTag, NButton, NSpace,
  NModal, NForm, NFormItem, NInput, NSelect, NSwitch, NDataTable,
  useMessage, type DataTableColumns,
} from 'naive-ui';
import { http } from '../../api/client';

interface Env { id: string; name: string; triggerBranch: string; deployPath: string; protected: boolean; domain: string | null }
interface EnvVar { id: string; key: string }

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgSlug = route.params['orgSlug'] as string;
const projectSlug = route.params['projectSlug'] as string;

const envs = ref<Env[]>([]);
const servers = ref<{ id: string; name: string }[]>([]);
const serverOptions = ref<{ label: string; value: string }[]>([]);
const showAdd = ref(false);
const adding = ref(false);
const envForm = ref({ name: '', triggerBranch: 'main', serverId: '', deployPath: '', domain: '', healthCheckUrl: '', protected: false });

const showVarModal = ref(false);
const selectedEnv = ref<Env | null>(null);
const envVars = ref<EnvVar[]>([]);
const newVar = ref({ key: '', value: '' });

const varColumns: DataTableColumns<EnvVar> = [
  { title: 'KEY', key: 'key' },
  {
    title: '操作', key: 'actions', width: 80,
    render: (r) => h(NButton, { size: 'tiny', type: 'error', onClick: () => deleteVar(r.id) }, { default: () => '删除' }),
  },
];

function openVarModal(env: Env) {
  selectedEnv.value = env;
  showVarModal.value = true;
  void loadVars(env.id);
}

async function loadVars(envId: string) {
  envVars.value = await http.get<EnvVar[]>(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}/variables`).then((r) => r.data);
}

async function addVar() {
  if (!newVar.value.key || !newVar.value.value || !selectedEnv.value) return;
  await http.post(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${selectedEnv.value.id}/variables`, newVar.value);
  newVar.value = { key: '', value: '' };
  await loadVars(selectedEnv.value.id);
  message.success('已添加');
}

async function deleteVar(varId: string) {
  await http.delete(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${selectedEnv.value!.id}/variables/${varId}`);
  await loadVars(selectedEnv.value!.id);
}

async function deleteEnv(envId: string) {
  await http.delete(`/orgs/${orgSlug}/projects/${projectSlug}/environments/${envId}`);
  message.success('已删除');
  await load();
}

async function handleAddEnv() {
  adding.value = true;
  try {
    await http.post(`/orgs/${orgSlug}/projects/${projectSlug}/environments`, envForm.value);
    message.success('环境创建成功');
    showAdd.value = false;
    await load();
  } catch {
    message.error('创建失败');
  } finally {
    adding.value = false;
  }
}

async function load() {
  const [envData, serverData] = await Promise.all([
    http.get<Env[]>(`/orgs/${orgSlug}/projects/${projectSlug}/environments`).then((r) => r.data),
    http.get<{ id: string; name: string }[]>(`/orgs/${orgSlug}/servers`).then((r) => r.data),
  ]);
  envs.value = envData;
  servers.value = serverData;
  serverOptions.value = serverData.map((s) => ({ label: `${s.name}`, value: s.id }));
}

onMounted(load);
</script>
