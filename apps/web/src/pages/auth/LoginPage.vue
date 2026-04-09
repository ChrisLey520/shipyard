<template>
  <div class="auth-container">
    <n-card title="登录 Shipyard" style="width: 400px">
      <n-form :model="form" @submit.prevent="handleSubmit">
        <n-form-item label="邮箱">
          <n-input
            v-model:value="form.email"
            type="text"
            :input-props="{ type: 'email' }"
            placeholder="your@email.com"
          />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" placeholder="密码" />
        </n-form-item>
        <n-button
          type="primary"
          block
          :loading="loading"
          attr-type="submit"
          style="margin-top: 8px"
        >
          登录
        </n-button>
      </n-form>

      <template #footer>
        <div style="display: flex; justify-content: space-between; font-size: 13px">
          <router-link to="/register">没有账号？注册</router-link>
          <router-link to="/forgot-password">忘记密码</router-link>
        </div>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const message = useMessage();
const loading = ref(false);

const form = ref({ email: '', password: '' });

async function handleSubmit() {
  if (!form.value.email || !form.value.password) {
    message.warning('请填写邮箱和密码');
    return;
  }
  loading.value = true;
  try {
    await auth.login(form.value.email, form.value.password);
    const redirect = (route.query['redirect'] as string) ?? '/orgs';
    void router.push(redirect);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message ?? '登录失败，请检查邮箱和密码');
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
  background: var(--n-body-color);
}
</style>
