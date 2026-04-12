<template>
  <view class="p-3">
    <wd-cell-group :title="t('settings.basicInfo')" border>
      <wd-cell :title="t('settings.avatar')">
        <wd-button size="small" :loading="uploadingAvatar" @click="pickAvatar">
          {{ t('settings.uploadAvatar') }}
        </wd-button>
      </wd-cell>
      <wd-cell :title="t('settings.name')" :value="auth.user?.name ?? '—'" />
      <wd-cell :title="t('settings.email')" :value="auth.user?.email ?? '—'" />
      <wd-cell
        :title="t('settings.language')"
        is-link
        :value="localeLabel"
        @click="showLang = true"
      />
    </wd-cell-group>

    <wd-button block type="primary" custom-class="mt-4" :loading="savingLocale" @click="saveLocale">
      {{ t('common.save') }}
    </wd-button>

    <wd-cell-group :title="t('settings.security')" border custom-class="mt-4">
      <wd-cell :title="t('settings.changePassword')" is-link @click="openPwd" />
    </wd-cell-group>

    <wd-button block plain custom-class="mt-4" @click="logout">{{ t('auth.logout') }}</wd-button>

    <wd-action-sheet
      v-model="showLang"
      :actions="langActions"
      cancel-text="取消"
      @select="onLangSelect"
    />

    <wd-popup v-model="showPwd" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <text class="font-medium">{{ t('settings.changePasswordTitle') }}</text>
        <wd-input v-model="pwd.oldPassword" class="mt-2" :label="t('settings.oldPassword')" show-password />
        <wd-input v-model="pwd.newPassword" :label="t('settings.newPassword')" show-password />
        <wd-input v-model="pwd.confirm" :label="t('settings.confirmPassword')" show-password />
        <wd-button block type="primary" class="mt-3" :loading="changingPwd" @click="submitPwd">
          {{ t('settings.confirmChange') }}
        </wd-button>
        <wd-button block plain class="mt-2" @click="showPwd = false">{{ t('common.cancel') }}</wd-button>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';
import * as usersApi from '@/api/users';
import { reLaunchToLoginWithRedirect } from '@/utils/redirectLogin';

const { t, locale } = useI18n();
const auth = useAuthStore();

const uploadingAvatar = ref(false);
const savingLocale = ref(false);
const showLang = ref(false);
const selectedLocale = ref<'zh-CN' | 'en'>('zh-CN');
const showPwd = ref(false);
const changingPwd = ref(false);
const pwd = ref({ oldPassword: '', newPassword: '', confirm: '' });

const langActions = [
  { name: '中文（简体）', value: 'zh-CN' as const },
  { name: 'English', value: 'en' as const },
];

const localeLabel = computed(() => (selectedLocale.value === 'en' ? 'English' : '中文（简体）'));

onShow(() => {
  if (!auth.isAuthenticated) {
    reLaunchToLoginWithRedirect();
    return;
  }
  syncLocaleFromUser();
});

watch(
  () => auth.user?.locale,
  () => syncLocaleFromUser(),
);

function syncLocaleFromUser() {
  const l = auth.user?.locale;
  selectedLocale.value = l === 'en' ? 'en' : 'zh-CN';
  locale.value = selectedLocale.value;
}

function onLangSelect(payload: { index: number }) {
  const opt = langActions[payload.index];
  if (!opt) return;
  selectedLocale.value = opt.value;
  locale.value = opt.value;
}

async function saveLocale() {
  savingLocale.value = true;
  try {
    await usersApi.updateMyLocale(selectedLocale.value);
    locale.value = selectedLocale.value;
    await auth.fetchMe();
    syncLocaleFromUser();
    uni.showToast({ title: t('common.saved'), icon: 'success' });
  } catch {
    // 全局 request 已提示
  } finally {
    savingLocale.value = false;
  }
}

function pickAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const path = res.tempFilePaths[0];
      if (!path) return;
      uploadingAvatar.value = true;
      try {
        await usersApi.uploadMyAvatar(path);
        await auth.fetchMe();
        uni.showToast({ title: t('settings.avatarUpdated'), icon: 'success' });
      } catch {
        // 全局 request 已提示
      } finally {
        uploadingAvatar.value = false;
      }
    },
  });
}

function openPwd() {
  pwd.value = { oldPassword: '', newPassword: '', confirm: '' };
  showPwd.value = true;
}

async function submitPwd() {
  const { oldPassword, newPassword, confirm } = pwd.value;
  if (!oldPassword || !newPassword || !confirm) {
    uni.showToast({ title: t('settings.fillAllPasswordFields'), icon: 'none' });
    return;
  }
  if (newPassword.length < 8) {
    uni.showToast({ title: t('settings.passwordMinLength'), icon: 'none' });
    return;
  }
  if (newPassword !== confirm) {
    uni.showToast({ title: t('settings.passwordNotMatch'), icon: 'none' });
    return;
  }
  if (oldPassword === newPassword) {
    uni.showToast({ title: t('settings.passwordSameAsOld'), icon: 'none' });
    return;
  }
  changingPwd.value = true;
  try {
    await authApi.changePassword(oldPassword, newPassword);
    const email = auth.user?.email ?? '';
    await auth.logout();
    showPwd.value = false;
    uni.showModal({
      title: t('settings.passwordChangeSuccessTitle'),
      content: t('settings.passwordChangeSuccessContent'),
      showCancel: false,
      success: () => {
        uni.reLaunch({ url: `/pages/auth/login?email=${encodeURIComponent(email)}` });
      },
    });
  } catch {
    // 全局 request 已提示
  } finally {
    changingPwd.value = false;
  }
}

async function logout() {
  await auth.logout();
  uni.reLaunch({ url: '/pages/auth/login' });
}
</script>
