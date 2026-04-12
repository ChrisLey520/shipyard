<template>
  <view class="p-4">
    <view class="text-xl font-bold mb-6">Shipyard</view>
    <wd-input v-model="email" label="邮箱" placeholder="email@example.com" clearable />
    <wd-input v-model="password" label="密码" type="text" show-password clearable />
    <wd-button block type="primary" custom-class="mt-4" :loading="loading" @click="onLogin">
      登录
    </wd-button>
    <wd-button block plain custom-class="mt-2" @click="goRegister">注册</wd-button>
    <wd-button block type="text" size="small" custom-class="mt-2" @click="goForgot">忘记密码</wd-button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useAuthStore } from '@/stores/auth';
import { HttpError } from '@/api/http';

const auth = useAuthStore();
const email = ref('');
const password = ref('');
const loading = ref(false);

onLoad((q) => {
  const e = (q as { email?: string }).email;
  if (e) email.value = decodeURIComponent(e);
});

onShow(() => {
  if (auth.isAuthenticated) {
    uni.reLaunch({ url: '/pages/orgs/list' });
  }
});

async function onLogin() {
  if (!email.value.trim() || !password.value) {
    uni.showToast({ title: '请填写邮箱和密码', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    uni.reLaunch({ url: '/pages/orgs/list' });
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : '登录失败';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goRegister() {
  uni.navigateTo({ url: '/pages/auth/register' });
}

function goForgot() {
  uni.navigateTo({ url: '/pages/auth/forgot' });
}
</script>
