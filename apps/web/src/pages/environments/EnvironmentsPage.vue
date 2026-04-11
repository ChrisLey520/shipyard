<template>
  <div class="page min-w-0">
    <n-page-header title="环境管理" @back="router.back()">
      <template #extra>
        <n-button type="primary" @click="openCreateModal">+ 新建环境</n-button>
      </template>
    </n-page-header>

    <div
      v-if="envs.length === 0"
      class="mt-1 min-h-[52vh] flex items-center justify-center"
    >
      <n-empty description="还没有部署环境">
        <template #extra>
          <n-button type="primary" @click="openCreateModal">+ 新建环境</n-button>
        </template>
      </n-empty>
    </div>

    <div v-else class="mt-1 grid grid-cols-1 gap-4 md:grid-cols-2">
      <n-card
        v-for="env in envs"
        :key="env.id"
        size="small"
        class="card overflow-hidden transition-shadow duration-200 hover:shadow-md"
        :id="`env-card-${env.id}`"
        :class="{ 'env-card-focused': focusedEnvId === env.id }"
        :segmented="{ content: true, footer: 'soft' }"
      >
        <template #header>
          <div class="flex items-start justify-between gap-3 min-w-0">
            <div class="min-w-0 flex-1">
              <div class="text-base font-600 leading-snug truncate">
                {{ env.name }}
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <n-tag size="small" type="info" :bordered="false" round>
                  {{ env.triggerBranch }}
                </n-tag>
                <n-tag
                  size="small"
                  :type="env.protected ? 'warning' : 'default'"
                  :bordered="false"
                  round
                >
                  {{ env.protected ? '受保护' : '开放' }}
                </n-tag>
              </div>
            </div>
          </div>
        </template>

        <div class="flex flex-col gap-2.5 text-sm">
          <div class="flex gap-2 min-w-0">
            <span class="muted shrink-0 w-20 text-right">服务器</span>
            <n-text class="min-w-0 truncate" depth="2">
              {{ serverLine(env) }}
            </n-text>
          </div>
          <div class="flex gap-2 min-w-0">
            <span class="muted shrink-0 w-20 text-right">部署路径</span>
            <n-text class="min-w-0 truncate text-[13px] font-mono" depth="2">
              {{ env.deployPath || '—' }}
            </n-text>
          </div>
          <div v-if="env.domain" class="flex gap-2 min-w-0">
            <span class="muted shrink-0 w-20 text-right">域名</span>
            <n-text class="min-w-0 truncate" depth="2">{{ env.domain }}</n-text>
          </div>
          <div v-if="env.healthCheckUrl" class="flex gap-2 min-w-0">
            <span class="muted shrink-0 w-20 text-right">健康检查</span>
            <n-text class="min-w-0 truncate" depth="2">{{ env.healthCheckUrl }}</n-text>
          </div>
        </div>

        <template #footer>
          <n-space justify="end" size="small">
            <n-button size="small" secondary @click="openEditModal(env)">编辑</n-button>
            <n-button size="small" quaternary @click="openVarModal(env)">管理变量</n-button>
            <n-button size="small" type="error" secondary @click="deleteEnv(env.id)">删除</n-button>
          </n-space>
        </template>
      </n-card>
    </div>

    <!-- 新建 / 编辑环境（复用组件） -->
    <environment-modal
      v-model:show="showEnvModal"
      :mode="envFormMode"
      :org-slug="orgSlug"
      :project-slug="projectSlug"
      :initial-env="editingEnv"
      @saved="onEnvSaved"
    />

    <!-- 环境变量管理 -->
    <n-modal
      v-model:show="showVarModal"
      :title="`${selectedEnv?.name} - 环境变量`"
      preset="card"
      style="width: 600px"
      :mask-closable="false"
      :close-on-esc="false"
    >
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
import { ref, h, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader, NCard, NTag, NButton, NSpace, NEmpty, NText,
  NModal, NInput, NDataTable,
  useMessage, type DataTableColumns,
} from 'naive-ui';
import { serverOsLabel } from '@shipyard/shared';
import EnvironmentModal from './components/EnvironmentModal.vue';
import {
  useEnvironmentsProjectActions,
  type Env,
  type EnvVar,
} from '@/composables/environments/useEnvironmentsProjectActions';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const projectSlug = computed(() => route.params['projectSlug'] as string);
const envApi = useEnvironmentsProjectActions(orgSlug, projectSlug);
const envIdFromQuery = computed(() => {
  const v = route.query['envId'];
  return typeof v === 'string' && v.trim() ? v : null;
});

const envs = ref<Env[]>([]);
const focusedEnvId = ref<string | null>(null);
const showEnvModal = ref(false);
const envFormMode = ref<'create' | 'edit'>('create');
const editingEnvId = ref<string | null>(null);
const editingEnv = computed<Env | null>(() => {
  if (!editingEnvId.value) return null;
  return envs.value.find((e) => e.id === editingEnvId.value) ?? null;
});

const showVarModal = ref(false);
const selectedEnv = ref<Env | null>(null);
const envVars = ref<EnvVar[]>([]);
const newVar = ref({ key: '', value: '' });

function openCreateModal() {
  envFormMode.value = 'create';
  editingEnvId.value = null;
  showEnvModal.value = true;
}

function openEditModal(env: Env) {
  envFormMode.value = 'edit';
  editingEnvId.value = env.id;
  showEnvModal.value = true;
}

const lastAutoOpenedEnvId = ref<string | null>(null);
async function tryAutoOpenEnvFromQuery() {
  const id = envIdFromQuery.value;
  if (!id) return;
  if (lastAutoOpenedEnvId.value === id) return;
  const env = envs.value.find((e) => e.id === id);
  if (!env) return;
  lastAutoOpenedEnvId.value = id;
  focusedEnvId.value = id;
  await nextTick();
  const el = document.getElementById(`env-card-${id}`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const next = { ...route.query };
  delete next['envId'];
  await router.replace({ path: route.path, query: next });
}

function serverLine(env: Env): string {
  const s = env.server;
  if (!s) return '—';
  const osLabel = s.os ? serverOsLabel(s.os) : '';
  return osLabel ? `${s.name} · ${s.host}（${osLabel}）` : `${s.name} · ${s.host}`;
}

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
  envVars.value = await envApi.listEnvVars(envId);
}

async function addVar() {
  if (!newVar.value.key || !newVar.value.value || !selectedEnv.value) return;
  await envApi.upsertEnvVar(selectedEnv.value.id, newVar.value);
  newVar.value = { key: '', value: '' };
  await loadVars(selectedEnv.value.id);
  message.success('已添加');
}

async function deleteVar(varId: string) {
  await envApi.deleteEnvVar(selectedEnv.value!.id, varId);
  await loadVars(selectedEnv.value!.id);
}

async function deleteEnv(envId: string) {
  await envApi.deleteEnvironment(envId);
  message.success('已删除');
  await load();
}

async function onEnvSaved() {
  showEnvModal.value = false;
  editingEnvId.value = null;
  await load();
}

async function load() {
  envs.value = await envApi.listEnvironments();
}

watch([orgSlug, projectSlug], () => {
  void load();
}, { immediate: true });

watch([envIdFromQuery, envs], () => {
  void tryAutoOpenEnvFromQuery();
});

// modal handles its own options loading
</script>

<style scoped>
.env-card-focused {
  outline: 2px solid color-mix(in srgb, var(--n-info-color) 55%, transparent);
  outline-offset: 2px;
}
</style>
