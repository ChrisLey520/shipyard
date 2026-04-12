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
          <div class="auth-aside-title mt-4">让部署与审批更清晰、更可靠</div>
          <div class="auth-aside-list">
            <div class="flex items-start gap-2">
              <span class="mt-[2px] i-carbon-checkmark-filled text-brand-600" />
              <span>统一组织/项目/环境视图，减少上下文切换</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-[2px] i-carbon-checkmark-filled text-brand-600" />
              <span>部署状态与耗时可追踪，问题定位更快</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-[2px] i-carbon-checkmark-filled text-brand-600" />
              <span>审批流内置，关键操作更安全</span>
            </div>
          </div>
        </div>
        <div class="text-xs text-[var(--n-text-color-3)]">© Shipyard</div>
      </aside>

      <div class="auth-card-wrap">
        <n-card class="auth-card" :bordered="false" content-style="padding: 0">
          <div class="auth-card-body">
            <div class="page-title">登录</div>
            <div class="text-sm muted mt-1">登录后进入组织与项目管理后台</div>

            <n-divider class="!my-5" />

            <n-form :model="form" size="large" @submit.prevent="handleSubmit">
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
                  ref="passwordInputRef"
                  v-model:value="form.password"
                  type="password"
                  placeholder="请输入密码"
                  show-password-on="click"
                />
              </n-form-item>

              <n-button
                type="primary"
                block
                size="large"
                :loading="loading"
                attr-type="submit"
                class="mt-2"
              >
                登录
              </n-button>
            </n-form>

            <div class="flex items-center justify-between gap-3 mt-4">
              <router-link class="auth-muted-link" to="/register">没有账号？去注册</router-link>
              <router-link class="auth-muted-link" to="/forgot-password">忘记密码</router-link>
            </div>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, NButton, NDivider, useMessage } from 'naive-ui';
import { useEmailLogin } from '@/composables/auth/useEmailLogin';

const router = useRouter();
const route = useRoute();
const { loginWithEmailPassword } = useEmailLogin();
const message = useMessage();
const loading = ref(false);

const form = ref({ email: '', password: '' });
const passwordInputRef = ref<InstanceType<typeof NInput> | null>(null);

function syncEmailFromQueryAndFocusPassword() {
  const qEmail = (route.query['email'] as string | undefined) ?? '';
  if (qEmail) form.value.email = qEmail;
  void nextTick(() => {
    passwordInputRef.value?.focus?.();
  });
}

onMounted(syncEmailFromQueryAndFocusPassword);
watch(() => route.query['email'], syncEmailFromQueryAndFocusPassword);

async function handleSubmit() {
  if (!form.value.email || !form.value.password) {
    message.warning('请填写邮箱和密码');
    return;
  }
  loading.value = true;
  try {
    await loginWithEmailPassword(form.value.email, form.value.password);
    const redirect = (route.query['redirect'] as string) ?? '/orgs';
    void router.push(redirect);
  } finally {
    loading.value = false;
  }
}
</script>
