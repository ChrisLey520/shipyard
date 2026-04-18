<script setup lang="ts">
import { NSwitch } from 'naive-ui';

defineProps<{
  value: boolean;
  loading?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:value': [boolean] }>();
</script>

<template>
  <n-switch
    :value="value"
    :loading="loading"
    :disabled="disabled"
    @update:value="(v: boolean) => emit('update:value', v)"
  />
</template>
