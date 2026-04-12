<template>
  <wd-popup
    v-model="typedDestructiveShowMp"
    position="bottom"
    :safe-area-inset-bottom="true"
    custom-style="border-radius: 16px 16px 0 0;"
  >
    <view v-if="typedDestructiveShowMp && payload" class="p-4 pb-6">
      <view class="text-base font-semibold mb-2">{{ payload.title }}</view>
      <view class="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{{ payload.description }}</view>
      <view class="text-xs text-gray-500 mb-1">
        为确认此操作，请完整输入下方内容（区分大小写）。须输入的是：{{ payload.expectedLabel }}。
      </view>
      <view class="text-sm font-mono bg-gray-100 rounded px-2 py-2 mb-3 break-all">{{ payload.expected }}</view>
      <wd-input v-model="typedDestructiveDraftMp" :placeholder="`输入「${payload.expected}」`" clearable />
      <view class="flex gap-2 mt-4">
        <wd-button block plain @click="onCancel">取消</wd-button>
        <wd-button
          block
          type="error"
          :loading="typedDestructiveSubmittingMp"
          :disabled="!canSubmit"
          @click="onConfirm"
        >
          {{ payload.positiveText }}
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import {
  closeTypedDestructiveMp,
  typedDestructiveDraftMp,
  typedDestructivePayloadMp,
  typedDestructiveShowMp,
  typedDestructiveSubmittingMp,
} from '@/composables/typedDestructiveConfirmMp';

const payload = computed(() => typedDestructivePayloadMp.value);

const canSubmit = computed(() => {
  const p = payload.value;
  if (!p) return false;
  return typedDestructiveDraftMp.value.trim() === p.expected.trim();
});

watch(typedDestructiveShowMp, (v) => {
  if (!v) {
    typedDestructiveDraftMp.value = '';
    typedDestructiveSubmittingMp.value = false;
  }
});

function onCancel() {
  closeTypedDestructiveMp();
}

async function onConfirm() {
  const p = payload.value;
  if (!p || !canSubmit.value) {
    uni.showToast({ title: '输入与要求不一致', icon: 'none' });
    return;
  }
  typedDestructiveSubmittingMp.value = true;
  try {
    await p.onConfirm();
    closeTypedDestructiveMp();
  } catch {
    /* 全局 request 已提示 */
  } finally {
    typedDestructiveSubmittingMp.value = false;
  }
}
</script>
