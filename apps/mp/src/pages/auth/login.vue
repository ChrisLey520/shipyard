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
  <view class="login-root" :class="{ 'login-root--dark': isDark }" :style="authRootStyle">
    <view class="login-brand">
      <view class="login-brand-head">
        <view class="login-brand-mark">
          <text class="login-brand-mark-icon">⚓</text>
        </view>
        <text class="login-brand-name">Shipyard</text>
      </view>
      <text class="login-brand-tag">让部署与审批更清晰、更可靠</text>
      <view class="login-brand-rule" />
    </view>

    <view class="login-card">
      <view class="login-card-head">
        <text class="login-card-title">登录</text>
        <text class="login-card-sub">登录后进入组织与项目管理后台</text>
      </view>

      <view class="login-fields">
        <wd-input
          v-model="email"
          label="邮箱"
          placeholder="your@email.com"
          clearable
          custom-class="login-field"
        />
        <wd-input
          v-model="password"
          label="密码"
          type="text"
          show-password
          placeholder="请输入密码"
          clearable
          custom-class="login-field"
        />
      </view>

      <view class="login-btn-wrap">
        <wd-button
          block
          type="primary"
          size="large"
          round
          :loading="loading"
          custom-class="login-submit"
          @click="onLogin"
        >
          登录
        </wd-button>
      </view>

      <view class="login-links">
        <view class="login-link-hit" @click="goRegister">
          <text class="login-link-text">没有账号？去注册</text>
        </view>
        <view class="login-link-hit" @click="goForgot">
          <text class="login-link-text">忘记密码</text>
        </view>
      </view>
    </view>

    <view class="login-spacer" />

    <text class="login-footnote">© Shipyard</text>
  </view>
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref } from 'vue';
import { onLoad, onReady } from '@dcloudio/uni-app';
import { useAuthStore } from '@/stores/auth';
import { useAuthDarkRoot } from '@/composables/useAuthDarkRoot';
import { reLaunchAfterAuth, resolveLoginRedirect } from '@/utils/redirectLogin';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const auth = useAuthStore();
const { isDark, authRootStyle } = useAuthDarkRoot();
const email = ref('');
const password = ref('');
const loading = ref(false);
/** 登录成功后回跳（与 Web redirect query 对齐） */
const redirectParam = ref<string | undefined>(undefined);

onLoad((q) => {
  const query = q as { email?: string; redirect?: string };
  if (query.email) email.value = decodeURIComponent(query.email);
  if (query.redirect) redirectParam.value = query.redirect;
});

onReady(() => {
  if (auth.isAuthenticated) {
    reLaunchAfterAuth(redirectParam.value);
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
    reLaunchAfterAuth(redirectParam.value);
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

function goRegister() {
  let url = '/pages/auth/register';
  if (redirectParam.value) {
    const safe = resolveLoginRedirect(redirectParam.value);
    if (safe) url += `?redirect=${encodeURIComponent(redirectParam.value)}`;
  }
  uni.navigateTo({
    url,
    fail: (err) => {
      uni.showToast({ title: err.errMsg || '无法打开注册页', icon: 'none' });
    },
  });
}

function goForgot() {
  uni.navigateTo({ url: '/pages/auth/forgot' });
}
</script>

<style scoped lang="scss">
/* 小程序端 Uno presetApplet 常不生成任意值/渐变类，此处用 SCSS 保证真机可见 */

.login-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  padding: 40rpx 48rpx 40rpx;
  padding-bottom: calc(48rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  background: linear-gradient(165deg, #dce8f8 0%, #e8eef9 28%, #eef2f7 55%, #f8fafc 100%);
}

.login-brand {
  margin-bottom: 48rpx;
  margin-top: 12rpx;
}

/* 与 Web LoginPage auth-brand / auth-aside 文案与结构对齐 */
.login-brand-head {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.login-brand-mark {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #059669;
  box-shadow: 0 8rpx 24rpx rgba(5, 150, 105, 0.28);
}

.login-brand-mark-icon {
  font-size: 40rpx;
  line-height: 1;
  color: #ffffff;
}

.login-brand-name {
  margin-left: 20rpx;
  font-size: 36rpx;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
}

.login-brand-tag {
  display: block;
  margin-top: 28rpx;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.45;
  color: #64748b;
}

.login-brand-rule {
  height: 1rpx;
  margin-top: 40rpx;
  margin-bottom: 8rpx;
  background: linear-gradient(
    90deg,
    rgba(5, 150, 105, 0.25) 0%,
    rgba(148, 163, 184, 0.4) 50%,
    rgba(226, 232, 240, 0.95) 100%
  );
  border-radius: 1rpx;
}

.login-card {
  background-color: #ffffff;
  border-radius: 24rpx;
  border: 1rpx solid #e2e8f0;
  box-shadow: 0 12rpx 40rpx rgba(15, 23, 42, 0.07);
  padding: 48rpx 32rpx 44rpx;
}

.login-card-head {
  margin-bottom: 40rpx;
  padding: 0 8rpx;
}

.login-card-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: #0f172a;
}

.login-card-sub {
  display: block;
  margin-top: 18rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #94a3b8;
}

.login-fields {
  padding: 0 8rpx;
}

.login-btn-wrap {
  margin-top: 48rpx;
  padding: 0 8rpx;
}

.login-links {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: 44rpx;
  padding: 0 16rpx;
}

.login-link-hit {
  padding: 20rpx 12rpx;
  min-height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-link-text {
  font-size: 26rpx;
  color: #475569;
}

.login-spacer {
  flex: 1;
  min-height: 48rpx;
}

.login-footnote {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: #cbd5e1;
  padding-top: 16rpx;
  padding-bottom: 12rpx;
}

:deep(.login-field) {
  margin-bottom: 28rpx;
}

:deep(.login-submit.wd-button) {
  font-weight: 600;
  letter-spacing: 1rpx;
}

.login-root--dark .login-brand-name {
  color: #e2e8f0;
}

.login-root--dark .login-brand-tag {
  color: #94a3b8;
}

.login-root--dark .login-card {
  background-color: var(--auth-card-bg);
  border-color: rgba(148, 163, 184, 0.22);
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.35);
}

.login-root--dark .login-card-title {
  color: #f1f5f9;
}

.login-root--dark .login-card-sub {
  color: #94a3b8;
}

.login-root--dark .login-link-text {
  color: #cbd5e1;
}

.login-root--dark .login-footnote {
  color: #64748b;
}
</style>
