<template>
  <view class="p-4">
    <wd-input v-model="password" label="新密码" type="text" show-password clearable />
    <wd-button block type="primary" custom-class="mt-4" :loading="loading" @click="submit">重置密码</wd-button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { authApi } from '@/api/auth';
import { HttpError } from '@/api/http';

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
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : '失败';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>
