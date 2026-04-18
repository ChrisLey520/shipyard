<script setup lang="ts">
import { NTag } from 'naive-ui';

defineProps<{
  tagType: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error';
  label: string;
}>();
</script>

<template>
  <n-tag :type="tagType" size="small">{{ label }}</n-tag>
</template>
