<template>
  <div>
    <n-space justify="space-between" align="center" style="margin-bottom: 12px">
      <n-text depth="3">项目级开关，与部署流水线解耦；运行时 SDK 可后续接入。</n-text>
      <n-button size="small" type="primary" @click="openCreate">新增</n-button>
    </n-space>
    <n-data-table :columns="columns" :data="rows" :loading="loading" size="small" :row-key="(r) => r.id" />

    <n-modal
      v-model:show="showModal"
      :title="editingId ? '编辑开关' : '新增开关'"
      preset="card"
      style="width: 480px"
      :mask-closable="false"
    >
      <n-form label-placement="left" label-width="72">
        <n-form-item label="Key">
          <n-input v-model:value="form.key" placeholder="字母开头，如 feature.newUi" :disabled="!!editingId" />
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
        <n-form-item label="JSON 值">
          <n-input
            v-model:value="form.valueJson"
            type="textarea"
            placeholder='可选，如 {"rollout":10}'
            :rows="4"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="submit">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSwitch,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import {
  createFeatureFlag,
  deleteFeatureFlag,
  listFeatureFlags,
  updateFeatureFlag,
  type FeatureFlagRow,
} from '@/api/feature-flags';

const props = defineProps<{
  orgSlug: string;
  projectSlug: string;
}>();

const message = useMessage();
const rows = ref<FeatureFlagRow[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const form = ref({ key: '', enabled: false, valueJson: '' });

async function load() {
  loading.value = true;
  try {
    rows.value = await listFeatureFlags(props.orgSlug, props.projectSlug);
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.value = { key: '', enabled: false, valueJson: '' };
  showModal.value = true;
}

function openEdit(row: FeatureFlagRow) {
  editingId.value = row.id;
  form.value = {
    key: row.key,
    enabled: row.enabled,
    valueJson: row.valueJson != null ? JSON.stringify(row.valueJson, null, 2) : '',
  };
  showModal.value = true;
}

async function submit() {
  const key = form.value.key.trim();
  if (!key) {
    message.warning('请填写 key');
    return;
  }
  let valueJson: unknown = undefined;
  const raw = form.value.valueJson.trim();
  if (raw) {
    try {
      valueJson = JSON.parse(raw) as unknown;
    } catch {
      message.error('JSON 值无法解析');
      return;
    }
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await updateFeatureFlag(props.orgSlug, editingId.value, {
        enabled: form.value.enabled,
        valueJson: raw ? valueJson : null,
      });
      message.success('已保存');
    } else {
      await createFeatureFlag(props.orgSlug, {
        key,
        enabled: form.value.enabled,
        valueJson,
        projectSlug: props.projectSlug,
      });
      message.success('已创建');
    }
    showModal.value = false;
    await load();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    saving.value = false;
  }
}

async function removeRow(id: string) {
  try {
    await deleteFeatureFlag(props.orgSlug, id);
    message.success('已删除');
    await load();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  }
}

const columns: DataTableColumns<FeatureFlagRow> = [
  { title: 'Key', key: 'key', ellipsis: { tooltip: true } },
  {
    title: '启用',
    key: 'enabled',
    width: 80,
    render: (r) => (r.enabled ? '是' : '否'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    render: (r) =>
      h('div', { style: 'display:flex;gap:8px' }, [
        h(NButton, { size: 'tiny', onClick: () => openEdit(r) }, { default: () => '编辑' }),
        h(NButton, { size: 'tiny', type: 'error', onClick: () => removeRow(r.id) }, { default: () => '删除' }),
      ]),
  },
];

onMounted(() => void load());
</script>
