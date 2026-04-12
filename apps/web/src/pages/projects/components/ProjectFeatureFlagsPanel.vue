<template>
  <div>
    <n-space vertical size="small" style="margin-bottom: 12px">
      <n-space justify="space-between" align="center" wrap>
        <n-space align="center" wrap>
          <n-text depth="3">作用域</n-text>
          <n-select
            v-model:value="scopeValue"
            :options="scopeOptions"
            size="small"
            style="min-width: 200px"
            :consistent-menu-width="false"
          />
        </n-space>
        <n-button size="small" type="primary" :disabled="scopeDisabled" @click="openCreate">新增</n-button>
      </n-space>
      <n-text depth="3">{{ scopeHint }}</n-text>
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
import { computed, h, ref, watch } from 'vue';
import TableRowSwitchCell from '@/components/table/TableRowSwitchCell.vue';
import TableRowEditDeleteCell from '@/components/table/TableRowEditDeleteCell.vue';
import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
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

const PROJECT_SCOPE = '__project__';

const props = defineProps<{
  orgSlug: string;
  projectSlug: string;
  /** 当前项目下环境名称列表，用于环境级开关 */
  environmentNames: string[];
}>();

const message = useMessage();
const rows = ref<FeatureFlagRow[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const form = ref({ key: '', enabled: false, valueJson: '' });
const scopeValue = ref<string>(PROJECT_SCOPE);

const scopeOptions = computed(() => {
  const opts = [{ label: '项目级', value: PROJECT_SCOPE }];
  for (const name of props.environmentNames) {
    opts.push({ label: `环境：${name}`, value: name });
  }
  return opts;
});

const scopeEnvName = computed(() => (scopeValue.value === PROJECT_SCOPE ? null : scopeValue.value));

const scopeDisabled = computed(
  () => scopeValue.value !== PROJECT_SCOPE && !props.environmentNames.includes(scopeValue.value),
);

const scopeHint = computed(() => {
  if (scopeValue.value === PROJECT_SCOPE) {
    return '项目级开关，与部署流水线解耦；可与组织级、各环境级同名 key 并存。';
  }
  return `环境「${scopeValue.value}」内 key 唯一；可与项目级、组织级同名 key 并存。请先创建环境再选此项。`;
});

function envNameForApi(): string | undefined {
  return scopeEnvName.value ?? undefined;
}

async function load() {
  loading.value = true;
  try {
    rows.value = await listFeatureFlags(props.orgSlug, props.projectSlug, envNameForApi());
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.orgSlug, props.projectSlug, scopeValue.value] as const,
  () => void load(),
  { immediate: true },
);

watch(
  () => props.environmentNames.join('\0'),
  () => {
    if (scopeValue.value !== PROJECT_SCOPE && !props.environmentNames.includes(scopeValue.value)) {
      scopeValue.value = PROJECT_SCOPE;
    }
  },
);

function openCreate() {
  if (scopeDisabled.value) {
    message.warning('请先添加部署环境');
    return;
  }
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
        environmentName: envNameForApi() ?? null,
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

function confirmRemoveRow(row: FeatureFlagRow) {
  const scopeLabel =
    scopeValue.value === PROJECT_SCOPE ? '项目级' : `环境「${scopeValue.value}」`;
  openDestructiveNameConfirm({
    title: '删除特性开关？',
    description: `将删除${scopeLabel}开关「${row.key}」，且无法恢复。`,
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
      h(TableRowSwitchCell, {
        value: r.enabled,
        loading: togglingId.value === r.id,
        disabled: togglingId.value === r.id,
        'onUpdate:value': (v: boolean) => void toggleEnabled(r, v),
      }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    render: (r) =>
      h(TableRowEditDeleteCell, {
        onEdit: () => void openEdit(r),
        onDelete: () => void confirmRemoveRow(r),
      }),
  },
]);
</script>
