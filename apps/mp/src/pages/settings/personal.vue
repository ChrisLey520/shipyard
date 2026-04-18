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
  <view class="p-3 mp-tab-page--with-bottom-bar">
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
      <wd-cell
        :title="t('theme.appearance')"
        is-link
        ellipsis
        :value="appearanceLabel"
        @click="showTheme = true"
      />
    </wd-cell-group>

    <wd-cell-group :title="t('settings.security')" border custom-class="mt-4">
      <wd-cell :title="t('settings.changePassword')" is-link @click="openPwd" />
    </wd-cell-group>

    <wd-button block plain custom-class="mt-4" @click="logout">{{ t('auth.logout') }}</wd-button>

    <wd-action-sheet
      v-model="showLang"
      :actions="langActions"
      :cancel-text="t('common.cancel')"
      @select="onLangSelect"
    />

    <wd-action-sheet
      v-model="showTheme"
      :actions="themeActions"
      :cancel-text="t('common.cancel')"
      @select="onThemeSelect"
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
  <mp-main-tab-bar :tab-index="4" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';
import * as usersApi from '@/api/users';
import { reLaunchToLoginWithRedirect } from '@/utils/redirectLogin';
import { storage } from '@/utils/storage';
import { useThemeStore } from '@/stores/theme';
import type { ColorMode, ThemeId } from '@/theme/types';
const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const { t, locale } = useI18n();
const auth = useAuthStore();
const themeStore = useThemeStore();

const uploadingAvatar = ref(false);
const showLang = ref(false);
const showTheme = ref(false);
const selectedLocale = ref<'zh-CN' | 'en'>('zh-CN');
const showPwd = ref(false);
const changingPwd = ref(false);
const pwd = ref({ oldPassword: '', newPassword: '', confirm: '' });

const langActions = [
  { name: '中文（简体）', value: 'zh-CN' as const },
  { name: 'English', value: 'en' as const },
];

const localeLabel = computed(() => (selectedLocale.value === 'en' ? 'English' : '中文（简体）'));

const themeActions = computed(() => [
  { name: t('theme.toneFresh'), actionKey: 'theme:fresh' as const },
  { name: t('theme.toneOcean'), actionKey: 'theme:ocean' as const },
  { name: t('theme.toneViolet'), actionKey: 'theme:violet' as const },
  { name: t('theme.modeAuto'), actionKey: 'mode:auto' as const },
  { name: t('theme.modeLight'), actionKey: 'mode:light' as const },
  { name: t('theme.modeDark'), actionKey: 'mode:dark' as const },
]);

const toneLabel = computed(() => {
  const id = themeStore.themeId;
  if (id === 'ocean') return t('theme.toneOcean');
  if (id === 'violet') return t('theme.toneViolet');
  return t('theme.toneFresh');
});

const modeLabel = computed(() => {
  const mode = themeStore.colorMode;
  if (mode === 'auto') {
    return themeStore.isDark ? t('theme.followSystemDark') : t('theme.followSystemLight');
  }
  return mode === 'dark' ? t('theme.dark') : t('theme.light');
});

const appearanceLabel = computed(() => `${toneLabel.value} · ${modeLabel.value}`);

onShow(() => {
  if (!auth.isAuthenticated) {
    reLaunchToLoginWithRedirect();
    return;
  }
  themeStore.syncHostPreferredDark();
  applyPreferredLocale();
});

watch(
  () => auth.user?.locale,
  () => applyPreferredLocale(),
);

/** 本地 storage 优先于服务端：选语言未点保存时也能全局生效 */
function applyPreferredLocale() {
  const s = storage.getLocale();
  if (s === 'en' || s === 'zh-CN') {
    selectedLocale.value = s;
    locale.value = s;
    return;
  }
  const l = auth.user?.locale;
  selectedLocale.value = l === 'en' ? 'en' : 'zh-CN';
  locale.value = selectedLocale.value;
}

function userLocaleNormalized(): 'zh-CN' | 'en' {
  return auth.user?.locale === 'en' ? 'en' : 'zh-CN';
}

function onThemeSelect(payload: { item: { actionKey?: string } }) {
  const k = payload.item.actionKey;
  if (!k) return;
  if (k.startsWith('theme:')) {
    themeStore.setThemeId(k.slice('theme:'.length) as ThemeId);
  } else if (k.startsWith('mode:')) {
    themeStore.setColorMode(k.slice('mode:'.length) as ColorMode);
  }
  showTheme.value = false;
}

/** 选择语言后立即 PATCH /users/me，与 Web 端 persist 行为对齐（无需再点保存） */
async function onLangSelect(payload: { index: number }) {
  const opt = langActions[payload.index];
  if (!opt) return;
  if (
    opt.value === userLocaleNormalized() &&
    opt.value === storage.getLocale() &&
    opt.value === locale.value
  ) {
    showLang.value = false;
    return;
  }

  const snapshot = {
    selected: selectedLocale.value,
    i18n: locale.value,
    storage: storage.getLocale(),
  };

  selectedLocale.value = opt.value;
  locale.value = opt.value;
  storage.setLocale(opt.value);
  showLang.value = false;

  uni.showLoading({ title: t('common.loading'), mask: true });
  try {
    await usersApi.updateMyLocale(opt.value);
    await auth.fetchMe();
    uni.showToast({ title: t('common.saved'), icon: 'success' });
  } catch {
    selectedLocale.value = snapshot.selected;
    locale.value = snapshot.i18n;
    if (snapshot.storage === 'en' || snapshot.storage === 'zh-CN') {
      storage.setLocale(snapshot.storage);
    } else {
      storage.clearLocale();
    }
    applyPreferredLocale();
  } finally {
    uni.hideLoading();
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
