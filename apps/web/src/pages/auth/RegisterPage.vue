<template>
  <div class="auth-shell">
    <div class="auth-bg">
      <div class="auth-bg-blur-1" />
      <div class="auth-bg-blur-2" />
      <div class="auth-bg-grid" />
    </div>

    <div class="auth-wrap">
      <aside class="auth-aside">
        <div>
          <div class="auth-brand">
            <span class="auth-brand-mark">⚓</span>
            <span>Shipyard</span>
          </div>
          <div class="auth-aside-title mt-4">创建你的 Shipyard 账号</div>
          <div class="auth-aside-list">
            <div class="flex items-start gap-2">
              <span class="mt-[2px] i-carbon-checkmark-filled text-brand-600" />
              <span>团队协作：成员与权限清晰可控</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-[2px] i-carbon-checkmark-filled text-brand-600" />
              <span>项目与环境：配置集中管理、易追踪</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-[2px] i-carbon-checkmark-filled text-brand-600" />
              <span>审批与审计：关键操作更安全</span>
            </div>
          </div>
        </div>
        <div class="text-xs text-[var(--n-text-color-3)]">© Shipyard</div>
      </aside>

      <div class="auth-card-wrap">
        <n-card class="auth-card" :bordered="false" content-style="padding: 0">
          <div class="auth-card-body">
            <div class="page-title">注册</div>
            <div class="text-sm muted mt-1">创建账号后即可进入组织与项目管理后台</div>

            <n-divider class="!my-5" />

            <n-form :model="form" size="large" @submit.prevent="handleSubmit">
              <n-form-item label="用户名">
                <n-input v-model:value="form.name" placeholder="你的名字" clearable />
              </n-form-item>
              <n-form-item label="邮箱">
                <n-input
                  v-model:value="form.email"
                  type="text"
                  :input-props="{ type: 'email' }"
                  placeholder="your@email.com"
                  clearable
                />
              </n-form-item>
              <n-form-item label="密码">
                <n-input
                  v-model:value="form.password"
                  type="password"
                  placeholder="至少 8 位"
                  show-password-on="click"
                />
              </n-form-item>
              <n-button type="primary" block size="large" :loading="loading" attr-type="submit" class="mt-2">
                注册
              </n-button>
            </n-form>

            <div class="mt-4">
              <router-link class="auth-muted-link" to="/login">已有账号？去登录</router-link>
            </div>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, NButton, NDivider, useMessage } from 'naive-ui';
import { useAuthRegistration } from '@/composables/auth/useAuthRegistration';

const router = useRouter();
const { registerAccount } = useAuthRegistration();
const message = useMessage();
const loading = ref(false);
const form = ref({ name: '', email: '', password: '' });

async function handleSubmit() {
  const name = form.value.name.trim();
  const email = form.value.email.trim();
  if (!name || !email || !form.value.password) {
    message.warning('请填写所有字段');
    return;
  }
  if (form.value.password.length < 8) {
    message.warning('密码至少 8 位');
    return;
  }
  loading.value = true;
  try {
    await registerAccount(name, email, form.value.password);
    void router.push('/orgs');
  } finally {
    loading.value = false;
  }
}
</script>
