<script setup lang="ts">
import { NIcon } from 'naive-ui';
import type { Component } from 'vue';

defineProps<{
  icon: Component;
}>();
</script>

<template>
  <n-icon :component="icon" />
</template>
