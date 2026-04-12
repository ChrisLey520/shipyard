<template>
  <div>
    <n-space justify="space-between" style="margin-bottom: 12px">
      <n-text depth="3">作用范围为整个组织（非单个项目）。</n-text>
      <n-button size="small" type="primary" @click="openCreate">新增</n-button>
    </n-space>
    <n-data-table :columns="columns" :data="rows" :loading="loading" size="small" :row-key="(r: FeatureFlagRow) => r.id" />

    <n-modal
      v-model:show="showModal"
      :title="editingId ? '编辑' : '新增'"
      preset="card"
      style="width: 480px"
      :mask-closable="false"
    >
      <n-form label-placement="left" label-width="72">
        <n-form-item label="Key">
          <n-input v-model:value="form.key" :disabled="!!editingId" />
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
        <n-form-item label="JSON">
          <n-input v-model:value="form.valueJson" type="textarea" :rows="4" />
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
import { computed, h, onMounted, ref } from 'vue';
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
import { openDestructiveNameConfirm } from '@/ui/destructiveNameConfirm';

const props = defineProps<{ orgSlug: string }>();
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
    rows.value = await listFeatureFlags(props.orgSlug);
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

function openEdit(r: FeatureFlagRow) {
  editingId.value = r.id;
  form.value = {
    key: r.key,
    enabled: r.enabled,
    valueJson: r.valueJson != null ? JSON.stringify(r.valueJson, null, 2) : '',
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
      message.error('JSON 无效');
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
    } else {
      await createFeatureFlag(props.orgSlug, { key, enabled: form.value.enabled, valueJson });
    }
    message.success('已保存');
    showModal.value = false;
    await load();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    saving.value = false;
  }
}

function confirmRemoveRow(row: FeatureFlagRow) {
  openDestructiveNameConfirm({
    title: '删除组织级特性开关？',
    description: `将删除「${row.key}」，且无法恢复。`,
    expected: row.key,
    expectedLabel: '开关 Key',
    positiveText: '删除',
    onConfirm: async () => {
      await deleteFeatureFlag(props.orgSlug, row.id);
      message.success('已删除');
      await load();
    },
  });
}

const togglingId = ref<string | null>(null);

async function toggleEnabled(row: FeatureFlagRow, enabled: boolean) {
  if (row.enabled === enabled) return;
  togglingId.value = row.id;
  try {
    await updateFeatureFlag(props.orgSlug, row.id, { enabled });
    message.success(enabled ? '已启用' : '已关闭');
    await load();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    togglingId.value = null;
  }
}

const columns = computed<DataTableColumns<FeatureFlagRow>>(() => [
  { title: 'Key', key: 'key', ellipsis: { tooltip: true } },
  {
    title: '启用',
    key: 'enabled',
    width: 96,
    render: (r) =>
      h(NSwitch, {
        value: r.enabled,
        loading: togglingId.value === r.id,
        disabled: togglingId.value === r.id,
        onUpdateValue: (v: boolean) => void toggleEnabled(r, v),
      }),
  },
  {
    title: '操作',
    key: 'a',
    width: 140,
    render: (r) =>
      h('div', { style: 'display:flex;gap:8px' }, [
        h(NButton, { size: 'tiny', onClick: () => openEdit(r) }, { default: () => '编辑' }),
        h(NButton, { size: 'tiny', type: 'error', onClick: () => confirmRemoveRow(r) }, { default: () => '删除' }),
      ]),
  },
]);

onMounted(() => void load());
</script>
