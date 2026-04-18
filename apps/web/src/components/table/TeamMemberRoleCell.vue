<script setup lang="ts">
import { NTag } from 'naive-ui';

defineProps<{
  role: string;
  tagType: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error';
}>();
</script>

<template>
  <n-tag :type="tagType" size="small">{{ role }}</n-tag>
</template>
