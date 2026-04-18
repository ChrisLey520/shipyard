<template>
  <page-meta
    :background-text-style="pageMetaBgText"
    :background-color="pageMetaBg"
    :background-color-top="pageMetaBg"
    :root-background-color="pageMetaBg"
    :background-color-bottom="pageMetaBg"
  />
  <mp-theme-provider>
  <mp-custom-nav-bar />
  <view class="register-root" :class="{ 'register-root--dark': isDark }" :style="authRootStyle">
    <view class="register-head">
      <text class="register-title">注册账号</text>
      <text class="register-sub">注册后即可使用小程序与网页管理后台</text>
    </view>

    <view class="register-card">
      <view class="register-fields">
        <wd-input v-model="name" label="姓名" placeholder="姓名或昵称" clearable custom-class="reg-field" />
        <wd-input v-model="email" label="邮箱" placeholder="you@company.com" clearable custom-class="reg-field" />
        <wd-input
          v-model="password"
          label="密码"
          type="text"
          show-password
          clearable
          custom-class="reg-field"
        />
      </view>

      <text class="register-rule">密码至少 8 位，与网页版规则相同</text>

      <view class="register-btn-wrap">
        <wd-button
          block
          type="primary"
          size="large"
          round
          :loading="loading"
          custom-class="reg-submit"
          @click="onRegister"
        >
          注册
        </wd-button>
      </view>

      <view class="register-back-wrap">
        <view class="register-back-hit" @click="goBack">
          <text class="register-back-text">已有账号，返回登录</text>
        </view>
      </view>
    </view>
  </view>
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useAuthStore } from '@/stores/auth';
import { useAuthDarkRoot } from '@/composables/useAuthDarkRoot';
import { reLaunchAfterAuth } from '@/utils/redirectLogin';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const auth = useAuthStore();
const { isDark, authRootStyle } = useAuthDarkRoot({ variant: 'register' });
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
    uni.showToast({ title: '请填写姓名、邮箱与密码', icon: 'none' });
    return;
  }
  if (password.value.length < 8) {
    uni.showToast({ title: '密码至少 8 位', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    await auth.register(name.value.trim(), email.value.trim(), password.value);
    reLaunchAfterAuth(redirectParam.value);
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped lang="scss">
.register-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 48rpx 32rpx;
  padding-bottom: calc(40rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #e8eef9 0%, #eef2f8 42%, #f8fafc 100%);
}

.register-head {
  margin-bottom: 40rpx;
  margin-top: 8rpx;
}

.register-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.5rpx;
}

.register-sub {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: #64748b;
}

.register-card {
  background-color: #ffffff;
  border-radius: 24rpx;
  border: 1rpx solid #e2e8f0;
  box-shadow: 0 12rpx 40rpx rgba(15, 23, 42, 0.07);
  padding: 40rpx 28rpx 36rpx;
}

.register-fields {
  padding: 0 4rpx;
}

.register-rule {
  display: block;
  margin-top: 8rpx;
  padding: 0 12rpx;
  font-size: 22rpx;
  line-height: 1.45;
  color: #94a3b8;
}

.register-btn-wrap {
  margin-top: 36rpx;
  padding: 0 4rpx;
}

.register-back-wrap {
  display: flex;
  justify-content: center;
  margin-top: 32rpx;
}

.register-back-hit {
  padding: 16rpx 24rpx;
}

.register-back-text {
  font-size: 26rpx;
  color: #475569;
}

:deep(.reg-field) {
  margin-bottom: 20rpx;
}

:deep(.reg-submit.wd-button) {
  font-weight: 600;
  letter-spacing: 1rpx;
}

.register-root--dark .register-title {
  color: #f1f5f9;
}

.register-root--dark .register-sub {
  color: #94a3b8;
}

.register-root--dark .register-card {
  background-color: var(--auth-card-bg);
  border-color: rgba(148, 163, 184, 0.22);
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.35);
}

.register-root--dark .register-rule {
  color: #64748b;
}

.register-root--dark .register-back-text {
  color: #cbd5e1;
}
</style>
