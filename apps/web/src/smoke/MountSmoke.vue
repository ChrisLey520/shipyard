<template>
  <span class="mount-smoke">{{ msg }}</span>
</template>

<script setup lang="ts">
/** 供 Vitest + test-utils 挂载冒烟；无路由/Naive 依赖 */
defineProps<{ msg: string }>();
</script>
