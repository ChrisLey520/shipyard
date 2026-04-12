<script setup lang="ts">
import { NTag } from 'naive-ui';

defineProps<{
  labels: string[];
}>();
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <n-tag v-for="(lab, i) in labels" :key="`${lab}-${i}`" size="small">{{ lab }}</n-tag>
  </div>
</template>
