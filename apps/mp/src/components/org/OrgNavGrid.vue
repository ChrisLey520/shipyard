<template>
  <view class="org-nav-grid flex flex-wrap gap-2">
    <wd-button
      v-for="item in items"
      :key="item.path"
      size="small"
      plain
      @click="go(item.path)"
    >
      {{ item.label }}
    </wd-button>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ orgSlug: string }>();

const items = computed(() => {
  const o = encodeURIComponent(props.orgSlug);
  const base = `/package-org/pages`;
  return [
    { label: '仪表盘', path: `${base}/dashboard/index?orgSlug=${o}` },
    { label: '项目', path: `${base}/projects/list?orgSlug=${o}` },
    { label: '服务器', path: `${base}/servers/index?orgSlug=${o}` },
    { label: '团队', path: `${base}/team/index?orgSlug=${o}` },
    { label: '审批', path: `${base}/approvals/index?orgSlug=${o}` },
    { label: 'Git', path: `${base}/git-accounts/index?orgSlug=${o}` },
    { label: '组织设置', path: `${base}/settings/org?orgSlug=${o}` },
  ];
});

function go(url: string) {
  uni.navigateTo({ url });
}
</script>

<style scoped>
.org-nav-grid {
  margin-bottom: 12px;
}
</style>
