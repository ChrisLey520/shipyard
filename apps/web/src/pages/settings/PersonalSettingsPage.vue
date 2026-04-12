<template>
  <div class="mx-auto w-full max-w-[720px] min-w-0 page-header-stack-sm">
    <n-page-header :title="t('settings.personalTitle')" />

    <n-card class="mt-4" :title="t('settings.basicInfo')">
      <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth">
        <n-form-item :label="t('settings.avatar')" :label-style="{ lineHeight: '48px' }">
          <div class="flex min-h-[48px] flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div ref="avatarBoxRef" style="width: 48px; height: 48px; flex: 0 0 48px">
              <n-avatar
                v-if="avatarResolvedUrl && !avatarImgFailed"
                :key="avatarResolvedUrl"
                :src="avatarResolvedUrl"
                round
                :size="48"
                object-fit="cover"
                :img-props="{ style: { objectFit: 'cover' } }"
                :on-error="handleAvatarError"
              />
              <n-avatar v-else round :size="48">
                {{ (auth.user?.name ?? auth.user?.email ?? 'U').slice(0, 1).toUpperCase() }}
              </n-avatar>
            </div>
            <n-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp"
              :max="1"
              :disabled="uploadingAvatar"
              @before-upload="handleBeforeUpload"
            >
              <n-button size="small" :loading="uploadingAvatar">{{ t('settings.uploadAvatar') }}</n-button>
            </n-upload>
          </div>
        </n-form-item>
        <n-form-item :label="t('settings.name')">
          <n-input v-model:value="name" :placeholder="t('settings.namePlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('settings.email')">
          <n-input v-model:value="email" :placeholder="t('settings.emailPlaceholder')" disabled />
        </n-form-item>

        <n-form-item :label="t('settings.language')">
          <n-select v-model:value="selectedLocale" :options="localeOptions" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="reset">{{ t('common.reset') }}</n-button>
          <n-button type="primary" :loading="saving" @click="save">{{ t('common.save') }}</n-button>
        </n-space>
      </template>
    </n-card>

    <n-card class="mt-4" :title="t('settings.security')">
      <n-form :label-placement="formLabelPlacement" :label-width="formLabelWidth">
        <n-form-item :label="t('settings.changePassword')">
          <n-button @click="openChangePassword">{{ t('settings.changePassword') }}</n-button>
        </n-form-item>
      </n-form>
    </n-card>

    <n-modal
      v-model:show="showChangePassword"
      :title="t('settings.changePasswordTitle')"
      preset="card"
      style="width: min(480px, calc(100vw - 32px))"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-form label-placement="left" label-width="90">
        <n-form-item :label="t('settings.oldPassword')">
          <n-input
            v-model:value="changePasswordForm.oldPassword"
            type="password"
            :placeholder="t('settings.oldPasswordPlaceholder')"
            show-password-on="click"
            :disabled="changingPassword"
          />
        </n-form-item>
        <n-form-item :label="t('settings.newPassword')">
          <n-input
            v-model:value="changePasswordForm.newPassword"
            type="password"
            :placeholder="t('settings.newPasswordPlaceholder')"
            show-password-on="click"
            :disabled="changingPassword"
          />
        </n-form-item>
        <n-form-item :label="t('settings.confirmPassword')">
          <n-input
            v-model:value="changePasswordForm.confirmPassword"
            type="password"
            :placeholder="t('settings.confirmPasswordPlaceholder')"
            show-password-on="click"
            :disabled="changingPassword"
            @keyup.enter="handleChangePassword"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button :disabled="changingPassword" @click="showChangePassword = false">
            {{ t('common.cancel') }}
          </n-button>
          <n-button type="primary" :loading="changingPassword" @click="handleChangePassword">
            {{ t('settings.confirmChange') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useRouter } from 'vue-router';
import {
  NAvatar,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPageHeader,
  NSelect,
  NSpace,
  NUpload,
  useDialog,
  useMessage,
  type UploadFileInfo,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/auth';
import { usePersonalProfileApi } from '@/composables/users/usePersonalProfileApi';
import { useLocaleStore } from '../../stores/locale';
import type { SupportedLocale } from '../../i18n';

const message = useMessage();
const auth = useAuthStore();
const { uploadAvatar: uploadAvatarApi, changePassword: changePasswordApi } = usePersonalProfileApi();
const router = useRouter();
const dialog = useDialog();
const { t } = useI18n();
const localeStore = useLocaleStore();

/** 个人设置表单：窄屏顶栏标签，避免长标签挤占输入框 */
const settingsFormWide = useMediaQuery('(min-width: 640px)');
const formLabelPlacement = computed(() => (settingsFormWide.value ? 'left' : 'top'));
const formLabelWidth = computed(() => (settingsFormWide.value ? 120 : 'auto'));

const selectedLocale = ref<SupportedLocale>(localeStore.locale);
const localeOptions = computed(() => localeStore.options);

const avatarBoxRef = ref<HTMLElement | null>(null);

const saving = ref(false);
const email = computed(() => auth.user?.email ?? '');
const name = ref(auth.user?.name ?? '');
const avatarUrl = computed(() => auth.user?.avatarUrl ?? null);
const avatarBust = ref(Date.now());
const avatarDisplayUrl = computed(() => {
  if (!avatarUrl.value) return null;
  const sep = avatarUrl.value.includes('?') ? '&' : '?';
  return `${avatarUrl.value}${sep}v=${avatarBust.value}`;
});
const avatarResolvedUrl = computed(() => {
  if (!avatarDisplayUrl.value) return null;
  return new URL(avatarDisplayUrl.value, window.location.origin).toString();
});

const uploadingAvatar = ref(false);
const avatarImgFailed = ref(false);

const showChangePassword = ref(false);
const changingPassword = ref(false);
const changePasswordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

function reset() {
  name.value = auth.user?.name ?? '';
  selectedLocale.value = localeStore.locale;
}

async function save() {
  saving.value = true;
  try {
    await localeStore.setLocale(selectedLocale.value);
    message.success(t('common.saved'));
  } finally {
    saving.value = false;
  }
}

async function handleBeforeUpload(options: { file: UploadFileInfo }) {
  const raw = options.file.file;
  if (!raw) {
    message.error(t('settings.readFileFailed'));
    return false;
  }
  uploadingAvatar.value = true;
  try {
    const { avatarUrl: newAvatarUrl } = await uploadAvatarApi(raw);
    // 立即更新 UI（避免依赖 fetchMe 或浏览器缓存）
    if (auth.user) auth.user = { ...auth.user, avatarUrl: newAvatarUrl };
    avatarBust.value = Date.now();
    try {
      await auth.fetchMe();
    } catch {
      /* 资料刷新失败可忽略，头像已本地更新 */
    }
    message.success(t('settings.avatarUpdated'));
  } catch {
    /* 上传失败由全局 axios 拦截器提示 */
  } finally {
    uploadingAvatar.value = false;
  }
  return false;
}

function handleAvatarError() {
  avatarImgFailed.value = true;
  message.error(t('settings.avatarLoadFailed'));
}

function openChangePassword() {
  changePasswordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  showChangePassword.value = true;
}

async function handleChangePassword() {
  const { oldPassword, newPassword, confirmPassword } = changePasswordForm.value;
  if (!oldPassword || !newPassword || !confirmPassword) {
    message.warning(t('settings.fillAllPasswordFields'));
    return;
  }
  if (newPassword.length < 8) {
    message.warning(t('settings.passwordMinLength'));
    return;
  }
  if (newPassword !== confirmPassword) {
    message.warning(t('settings.passwordNotMatch'));
    return;
  }
  if (oldPassword === newPassword) {
    message.warning(t('settings.passwordSameAsOld'));
    return;
  }

  changingPassword.value = true;
  try {
    const emailToPrefill = auth.user?.email ?? '';
    await changePasswordApi(oldPassword, newPassword);
    await auth.logout();
    showChangePassword.value = false;

    dialog.success({
      title: t('settings.passwordChangeSuccessTitle'),
      content: t('settings.passwordChangeSuccessContent'),
      positiveText: t('settings.goLogin'),
      closable: false,
      maskClosable: false,
      onPositiveClick: () => {
        void router.push({
          path: '/login',
          query: { redirect: '/settings', email: emailToPrefill },
        });
      },
    });
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    changingPassword.value = false;
  }
}
</script>

