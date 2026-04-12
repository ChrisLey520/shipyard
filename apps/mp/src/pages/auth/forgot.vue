<template>
  <page-meta
    :background-text-style="pageMetaBgText"
    :background-color="pageMetaBg"
    :background-color-top="pageMetaBg"
    :root-background-color="pageMetaBg"
    :background-color-bottom="pageMetaBg"
  />
  <mp-theme-provider>
  <mp-custom-nav-bar />
  <view class="p-4 auth-page-fill" :class="{ 'auth-page-fill--dark': isDark }">
    <wd-input v-model="email" label="邮箱" placeholder="注册邮箱" clearable />
    <wd-button block type="primary" custom-class="mt-4" :loading="loading" @click="submit">发送重置邮件</wd-button>
  </view>
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref } from 'vue';
import { authApi } from '@/api/auth';
import { useAuthDarkRoot } from '@/composables/useAuthDarkRoot';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const { isDark } = useAuthDarkRoot();
const email = ref('');
const loading = ref(false);

async function submit() {
  if (!email.value.trim()) {
    uni.showToast({ title: '请输入邮箱', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    await authApi.forgotPassword(email.value.trim());
    uni.showToast({ title: '已发送（若邮箱存在）', icon: 'none' });
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-page-fill {
  min-height: 100%;
  box-sizing: border-box;
}
</style>
