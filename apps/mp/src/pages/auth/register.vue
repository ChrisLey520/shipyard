<template>
  <view class="p-4">
    <wd-input v-model="name" label="姓名" placeholder="名称" clearable />
    <wd-input v-model="email" label="邮箱" placeholder="email" clearable />
    <wd-input v-model="password" label="密码" type="text" show-password clearable />
    <wd-button block type="primary" custom-class="mt-4" :loading="loading" @click="onRegister">
      注册
    </wd-button>
    <wd-button block plain custom-class="mt-2" @click="goBack">返回登录</wd-button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useAuthStore } from '@/stores/auth';
import { HttpError } from '@/api/http';
import { reLaunchAfterAuth } from '@/utils/redirectLogin';

const auth = useAuthStore();
const name = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const redirectParam = ref<string | undefined>(undefined);

onLoad((q) => {
  const r = (q as { redirect?: string }).redirect;
  if (r) redirectParam.value = r;
});

async function onRegister() {
  if (!name.value.trim() || !email.value.trim() || !password.value) {
    uni.showToast({ title: '请填写完整', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    await auth.register(name.value.trim(), email.value.trim(), password.value);
    reLaunchAfterAuth(redirectParam.value);
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : '注册失败';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goBack() {
  uni.navigateBack();
}
</script>
