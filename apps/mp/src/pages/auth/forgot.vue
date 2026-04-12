<template>
  <view class="p-4">
    <wd-input v-model="email" label="邮箱" placeholder="注册邮箱" clearable />
    <wd-button block type="primary" custom-class="mt-4" :loading="loading" @click="submit">发送重置邮件</wd-button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { authApi } from '@/api/auth';
import { HttpError } from '@/api/http';

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
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : '请求失败';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>
