<template>
  <div class="auth-container">
    <n-card title="注册 Shipyard" style="width: 400px">
      <n-form :model="form" @submit.prevent="handleSubmit">
        <n-form-item label="用户名">
          <n-input v-model:value="form.name" placeholder="你的名字" />
        </n-form-item>
        <n-form-item label="邮箱">
          <n-input
            v-model:value="form.email"
            type="text"
            :input-props="{ type: 'email' }"
            placeholder="your@email.com"
          />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" placeholder="至少 8 位" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" attr-type="submit" style="margin-top: 8px">
          注册
        </n-button>
      </n-form>
      <template #footer>
        <router-link to="/login" style="font-size: 13px">已有账号？去登录</router-link>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const message = useMessage();
const loading = ref(false);
const form = ref({ name: '', email: '', password: '' });

async function handleSubmit() {
  if (!form.value.name || !form.value.email || !form.value.password) {
    message.warning('请填写所有字段');
    return;
  }
  if (form.value.password.length < 8) {
    message.warning('密码至少 8 位');
    return;
  }
  loading.value = true;
  try {
    await auth.register(form.value.name, form.value.email, form.value.password);
    void router.push('/orgs');
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message ?? '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
