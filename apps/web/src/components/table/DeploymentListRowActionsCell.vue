<script setup lang="ts">
import { NButton } from 'naive-ui';
import { useRouter } from 'vue-router';
import type { DeploymentListItem } from '@/api/projects';

defineProps<{
  row: DeploymentListItem;
  detailPath: string;
}>();

const emit = defineEmits<{
  retry: [];
  rollback: [];
  delete: [];
}>();

const router = useRouter();
</script>

<template>
  <div style="display: flex; flex-wrap: wrap; gap: 8px">
    <n-button size="tiny" @click="router.push(detailPath)">详情</n-button>
    <n-button
      v-if="row.status === 'failed'"
      size="tiny"
      type="primary"
      secondary
      @click="emit('retry')"
    >
      重试
    </n-button>
    <n-button
      v-if="row.artifactId"
      size="tiny"
      type="warning"
      @click="emit('rollback')"
    >
      回滚
    </n-button>
    <n-button v-else size="tiny" disabled>回滚</n-button>
    <n-button size="tiny" type="error" secondary @click="emit('delete')">删除</n-button>
  </div>
</template>
