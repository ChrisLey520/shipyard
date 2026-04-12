<script setup lang="ts">
import { NButton } from 'naive-ui';

withDefaults(
  defineProps<{
    /** 删除按钮是否 secondary（与 Naive 表格行内弱强调一致） */
    deleteSecondary?: boolean;
  }>(),
  { deleteSecondary: false },
);

const emit = defineEmits<{
  edit: [];
  delete: [];
}>();
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <n-button size="tiny" @click="emit('edit')">编辑</n-button>
    <n-button size="tiny" type="error" :secondary="deleteSecondary" @click="emit('delete')">删除</n-button>
  </div>
</template>
