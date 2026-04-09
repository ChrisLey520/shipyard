<template>
  <div class="auth-container">
    <n-card title="重置密码" style="width: 400px">
      <n-form @submit.prevent="handleSubmit">
        <n-form-item label="新密码">
          <n-input v-model:value="password" type="password" placeholder="至少 8 位" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" attr-type="submit">
          重置密码
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui';
import { authApi } from '../../api/auth';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const password = ref('');
const loading = ref(false);

async function handleSubmit() {
  const token = route.query['token'] as string;
  if (!token || !password.value || password.value.length < 8) {
    message.warning('密码至少 8 位');
    return;
  }
  loading.value = true;
  try {
    await authApi.resetPassword(token, password.value);
    message.success('密码重置成功，请登录');
    void router.push('/login');
  } catch {
    message.error('重置链接无效或已过期');
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
