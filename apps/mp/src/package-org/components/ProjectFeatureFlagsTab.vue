<template>
  <view class="p-1">
    <picker mode="selector" :range="scopeLabels" :value="scopeIndex" @change="onScopePick">
      <wd-cell title="作用域" :value="scopeLabels[scopeIndex] ?? '项目级'" is-link />
    </picker>
    <text class="text-xs text-gray-500 block px-3 pb-2">{{ scopeHint }}</text>
    <view class="flex justify-end mb-2">
      <wd-button size="small" type="primary" :disabled="scopeAddDisabled" @click="openCreate">新增</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <view v-else>
      <view
        v-for="r in rows"
        :key="r.id"
        class="mb-2 p-3 rounded-lg bg-white border border-gray-200 flex justify-between items-center gap-2"
      >
        <view class="flex-1 min-w-0" @click="openEdit(r)">
          <text class="font-medium">{{ r.key }}</text>
        </view>
        <view class="flex items-center gap-2 shrink-0" @click.stop>
          <wd-switch
            :model-value="r.enabled"
            :disabled="togglingId === r.id"
            @update:model-value="(v: boolean | string | number) => onToggleEnabled(r, Boolean(v))"
          />
          <wd-button size="small" plain type="error" @click="confirmRemoveRow(r)">删除</wd-button>
        </view>
      </view>
    </view>
    <mp-page-empty v-if="!loading && !rows.length" variant="embed" title="暂无特性开关" />

    <wd-popup v-model="showModal" position="bottom" :safe-area-inset-bottom="true">
      <scroll-view scroll-y class="max-h-80vh p-4">
        <wd-input v-model="form.key" label="Key" :disabled="!!editingId" placeholder="如 feature.xxx" />
        <wd-cell title="启用" center>
          <wd-switch v-model="form.enabled" />
        </wd-cell>
        <wd-textarea v-model="form.valueJson" label="JSON 值" placeholder="可选" />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="submit">保存</wd-button>
        <wd-button block plain class="mt-2" @click="showModal = false">取消</wd-button>
      </scroll-view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import * as featureApi from '@/package-org/api/feature-flags';
import type { FeatureFlagRow } from '@/package-org/api/feature-flags';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import { openTypedDestructiveMp } from '@/composables/typedDestructiveConfirmMp';

const props = defineProps<{
  orgSlug: string;
  projectSlug: string;
  environmentNames: string[];
}>();

const loading = ref(false);
const rows = ref<FeatureFlagRow[]>([]);
const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const form = ref({ key: '', enabled: false, valueJson: '' });
const togglingId = ref<string | null>(null);
const scopeIndex = ref(0);

const scopeLabels = computed(() => {
  const labels = ['项目级'];
  for (const n of props.environmentNames) {
    labels.push(`环境：${n}`);
  }
  return labels;
});

const scopeEnvName = computed(() => {
  if (scopeIndex.value <= 0) return undefined;
  return props.environmentNames[scopeIndex.value - 1];
});

const scopeHint = computed(() => {
  if (scopeIndex.value === 0) {
    return '项目级开关；可与组织级、各环境级同名 key 并存。';
  }
  const name = scopeEnvName.value;
  return name
    ? `环境「${name}」内 key 唯一。`
    : '请先添加部署环境。';
});

const scopeAddDisabled = computed(() => {
  if (scopeIndex.value === 0) return false;
  return !scopeEnvName.value;
});

watch(
  () => props.environmentNames.join('\0'),
  () => {
    const max = Math.max(0, props.environmentNames.length);
    if (scopeIndex.value > max) scopeIndex.value = 0;
  },
);

async function load() {
  if (!props.orgSlug || !props.projectSlug) return;
  loading.value = true;
  try {
    rows.value = await featureApi.listFeatureFlags(
      props.orgSlug,
      props.projectSlug,
      scopeEnvName.value,
    );
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

function onScopePick(e: { detail: { value: string | number } }) {
  scopeIndex.value = Number(e.detail.value);
}

watch(
  () => [props.orgSlug, props.projectSlug, scopeIndex.value] as const,
  () => void load(),
  { immediate: true },
);

async function onToggleEnabled(row: FeatureFlagRow, enabled: boolean) {
  if (row.enabled === enabled) return;
  togglingId.value = row.id;
  try {
    await featureApi.updateFeatureFlag(props.orgSlug, row.id, { enabled });
    uni.showToast({ title: enabled ? '已启用' : '已关闭', icon: 'success' });
    await load();
  } catch {
    // 全局 request 已提示
  } finally {
    togglingId.value = null;
  }
}

function openCreate() {
  if (scopeAddDisabled.value) {
    uni.showToast({ title: '请先添加部署环境', icon: 'none' });
    return;
  }
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
    uni.showToast({ title: '请填写 Key', icon: 'none' });
    return;
  }
  let valueJson: unknown;
  const raw = form.value.valueJson.trim();
  if (raw) {
    try {
      valueJson = JSON.parse(raw) as unknown;
    } catch {
      uni.showToast({ title: 'JSON 无效', icon: 'none' });
      return;
    }
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await featureApi.updateFeatureFlag(props.orgSlug, editingId.value, {
        enabled: form.value.enabled,
        valueJson: raw ? valueJson : null,
      });
    } else {
      await featureApi.createFeatureFlag(props.orgSlug, {
        key,
        enabled: form.value.enabled,
        valueJson: raw ? valueJson : undefined,
        projectSlug: props.projectSlug,
        environmentName: scopeEnvName.value ?? null,
      });
    }
    uni.showToast({ title: '已保存', icon: 'success' });
    showModal.value = false;
    await load();
  } catch {
    // 全局 request 已提示
  } finally {
    saving.value = false;
  }
}

function confirmRemoveRow(r: FeatureFlagRow) {
  const scopeLabel = scopeIndex.value === 0 ? '项目级' : `环境「${scopeEnvName.value}」`;
  openTypedDestructiveMp({
    title: '删除特性开关？',
    description: `将删除${scopeLabel}开关「${r.key}」，且无法恢复。`,
    expected: r.key,
    expectedLabel: '开关 Key',
    positiveText: '删除',
    onConfirm: async () => {
      await featureApi.deleteFeatureFlag(props.orgSlug, r.id);
      uni.showToast({ title: '已删除', icon: 'success' });
      await load();
    },
  });
}
</script>
