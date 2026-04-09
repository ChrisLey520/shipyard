<template>
  <div class="auth-container">
    <n-card title="忘记密码" style="width: 400px">
      <n-alert v-if="sent" type="success" style="margin-bottom: 16px">
        重置链接已发送到你的邮箱，请查收（1 小时内有效）
      </n-alert>
      <n-form v-else @submit.prevent="handleSubmit">
        <n-form-item label="邮箱">
          <n-input
            v-model:value="email"
            type="text"
            :input-props="{ type: 'email' }"
            placeholder="your@email.com"
          />
        </n-form-item>
        <n-button type="primary" block :loading="loading" attr-type="submit">
          发送重置邮件
        </n-button>
      </n-form>
      <template #footer>
        <router-link to="/login" style="font-size: 13px">返回登录</router-link>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NForm, NFormItem, NInput, NButton, NAlert } from 'naive-ui';
import { authApi } from '../../api/auth';

const email = ref('');
const loading = ref(false);
const sent = ref(false);

async function handleSubmit() {
  if (!email.value) return;
  loading.value = true;
  try {
    await authApi.forgotPassword(email.value);
    sent.value = true;
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
