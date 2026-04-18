<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="opts?.title"
    :closable="true"
    :mask-closable="false"
    :close-on-esc="true"
    :auto-focus="false"
    style="width: min(100%, 480px)"
  >
    <n-space v-if="opts" vertical :size="12" style="margin-top: 4px">
      <n-text depth="3" style="white-space: pre-wrap">{{ opts.description }}</n-text>
      <div>
        <n-text depth="3" style="font-size: 13px; display: block; margin-bottom: 6px">
          为确认此操作，请完整输入下方内容（区分大小写）。须输入的是：{{ opts.expectedLabel }}。
        </n-text>
        <n-text code style="word-break: break-all; display: block; line-height: 1.5">
          {{ opts.expected }}
        </n-text>
      </div>
      <n-input
        v-model:value="destructiveNameConfirmDraft"
        type="text"
        :placeholder="`输入「${opts.expected}」`"
        clearable
        @keyup.enter="void onConfirm()"
      />
    </n-space>
    <template #action>
      <n-space justify="end">
        <n-button :disabled="destructiveNameConfirmSubmitting" @click="onCancel">取消</n-button>
        <n-button
          type="error"
          :disabled="!canSubmit"
          :loading="destructiveNameConfirmSubmitting"
          @click="void onConfirm()"
        >
          {{ opts?.positiveText ?? '确认' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NInput, NModal, NSpace, NText, useMessage } from 'naive-ui';
import {
  closeDestructiveNameConfirm,
  destructiveNameConfirmDraft,
  destructiveNameConfirmOptions,
  destructiveNameConfirmShow,
  destructiveNameConfirmSubmitting,
} from '@/ui/destructiveNameConfirm';

const message = useMessage();

const opts = computed(() => destructiveNameConfirmOptions.value);

const visible = ref(false);

watch(
  destructiveNameConfirmShow,
  (v) => {
    visible.value = v;
  },
  { immediate: true },
);

watch(visible, (v) => {
  if (!v && destructiveNameConfirmShow.value) {
    closeDestructiveNameConfirm();
  }
});

const canSubmit = computed(() => {
  const o = opts.value;
  if (!o) return false;
  return destructiveNameConfirmDraft.value.trim() === o.expected.trim();
});

function onCancel() {
  closeDestructiveNameConfirm();
  visible.value = false;
}

async function onConfirm() {
  const o = opts.value;
  if (!o || !canSubmit.value) {
    message.warning('输入与要求不一致，请核对后重试');
    return;
  }
  destructiveNameConfirmSubmitting.value = true;
  try {
    await o.onConfirm();
    closeDestructiveNameConfirm();
    visible.value = false;
  } catch {
    /* 错误由全局 axios 拦截器提示 */
  } finally {
    destructiveNameConfirmSubmitting.value = false;
  }
}

</script>
