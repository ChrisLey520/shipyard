<script setup lang="ts">
import { NButton } from 'naive-ui';

defineProps<{
  canRemove: boolean;
}>();

const emit = defineEmits<{ remove: [] }>();
</script>

<template>
  <n-button v-if="canRemove" size="small" type="error" @click="emit('remove')">移除</n-button>
  <span v-else>—</span>
</template>
