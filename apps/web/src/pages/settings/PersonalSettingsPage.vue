<template>
  <div style="max-width: 720px">
    <n-page-header :title="t('settings.personalTitle')" />

    <n-card style="margin-top: 16px" :title="t('settings.basicInfo')">
      <n-form label-placement="left" label-width="120">
        <n-form-item :label="t('settings.avatar')" :label-style="{ lineHeight: '48px' }">
          <div style="display: flex; align-items: center; gap: 12px; min-height: 48px">
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

    <n-card style="margin-top: 16px" :title="t('settings.security')">
      <n-form label-placement="left" label-width="120">
        <n-form-item :label="t('settings.changePassword')">
          <n-button @click="openChangePassword">{{ t('settings.changePassword') }}</n-button>
        </n-form-item>
      </n-form>
    </n-card>

    <n-modal
      v-model:show="showChangePassword"
      :title="t('settings.changePasswordTitle')"
      preset="card"
      style="width: 480px"
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
import { authApi } from '../../api/auth';
import { usersApi } from '../../api/users';
import { useLocaleStore } from '../../stores/locale';
import type { SupportedLocale } from '../../i18n';

const message = useMessage();
const auth = useAuthStore();
const router = useRouter();
const dialog = useDialog();
const { t } = useI18n();
const localeStore = useLocaleStore();

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
    const { avatarUrl: newAvatarUrl } = await usersApi.uploadMyAvatar(raw);
    // 立即更新 UI（避免依赖 fetchMe 或浏览器缓存）
    if (auth.user) auth.user = { ...auth.user, avatarUrl: newAvatarUrl };
    avatarBust.value = Date.now();
    await auth.fetchMe().catch(() => {});
    message.success(t('settings.avatarUpdated'));
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? t('settings.uploadFailed'));
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
    await authApi.changePassword(oldPassword, newPassword);
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
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? t('settings.changePasswordFailed'));
  } finally {
    changingPassword.value = false;
  }
}
</script>

