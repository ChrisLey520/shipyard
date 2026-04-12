<script setup lang="ts">
import { NButton } from 'naive-ui';

defineProps<{
  buttonText?: string;
}>();

const emit = defineEmits<{ delete: [] }>();
</script>

<template>
  <n-button size="tiny" type="error" @click="emit('delete')">
    {{ buttonText ?? '删除' }}
  </n-button>
</template>
