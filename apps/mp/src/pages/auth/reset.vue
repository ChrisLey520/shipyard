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
    <wd-input v-model="password" label="新密码" type="text" show-password clearable />
    <wd-button block type="primary" custom-class="mt-4" :loading="loading" @click="submit">重置密码</wd-button>
  </view>
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { authApi } from '@/api/auth';
import { useAuthDarkRoot } from '@/composables/useAuthDarkRoot';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const { isDark } = useAuthDarkRoot();
const token = ref('');
const password = ref('');
const loading = ref(false);

onLoad((q) => {
  token.value = (q?.token as string) || '';
});

async function submit() {
  if (!token.value || !password.value) {
    uni.showToast({ title: '缺少 token 或密码', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    await authApi.resetPassword(token.value, password.value);
    uni.showToast({ title: '已重置，请登录', icon: 'none' });
    setTimeout(() => uni.reLaunch({ url: '/pages/auth/login' }), 800);
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
