<script setup lang="ts">
import { NButton } from 'naive-ui';

const emit = defineEmits<{
  edit: [];
  test: [];
  delete: [];
}>();
</script>

<template>
  <div style="display: flex; gap: 8px">
    <n-button size="small" @click="emit('edit')">编辑</n-button>
    <n-button size="small" @click="emit('test')">连通测试</n-button>
    <n-button size="small" type="error" @click="emit('delete')">删除</n-button>
  </div>
</template>
