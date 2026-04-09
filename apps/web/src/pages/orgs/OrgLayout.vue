<template>
  <router-view />
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { useOrgStore } from '../../stores/org';

const route = useRoute();
const orgStore = useOrgStore();

watch(
  () => route.params['orgSlug'],
  (slug) => {
    if (slug) orgStore.setCurrentOrg(slug as string);
  },
  { immediate: true },
);
</script>
