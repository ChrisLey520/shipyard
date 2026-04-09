<template>
  <div style="max-width: 720px">
    <n-page-header title="个人设置" />

    <n-card style="margin-top: 16px" title="基础信息">
      <n-form label-placement="left" label-width="120">
        <n-form-item label="姓名">
          <n-input v-model:value="name" placeholder="请输入姓名" />
        </n-form-item>
        <n-form-item label="邮箱">
          <n-input v-model:value="email" placeholder="请输入邮箱" disabled />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="reset">重置</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-card>

    <n-card style="margin-top: 16px" title="安全">
      <n-form label-placement="left" label-width="120">
        <n-form-item label="修改密码">
          <n-button @click="openChangePassword">修改密码</n-button>
        </n-form-item>
      </n-form>
    </n-card>

    <n-modal
      v-model:show="showChangePassword"
      title="修改密码"
      preset="card"
      style="width: 480px"
      :mask-closable="!changingPassword"
      :close-on-esc="!changingPassword"
    >
      <n-form label-placement="left" label-width="90">
        <n-form-item label="原密码">
          <n-input
            v-model:value="changePasswordForm.oldPassword"
            type="password"
            placeholder="请输入原密码"
            show-password-on="click"
            :disabled="changingPassword"
          />
        </n-form-item>
        <n-form-item label="新密码">
          <n-input
            v-model:value="changePasswordForm.newPassword"
            type="password"
            placeholder="至少 8 位"
            show-password-on="click"
            :disabled="changingPassword"
          />
        </n-form-item>
        <n-form-item label="确认密码">
          <n-input
            v-model:value="changePasswordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password-on="click"
            :disabled="changingPassword"
            @keyup.enter="handleChangePassword"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button :disabled="changingPassword" @click="showChangePassword = false">取消</n-button>
          <n-button type="primary" :loading="changingPassword" @click="handleChangePassword">
            确认修改
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NForm, NFormItem, NInput, NModal, NPageHeader, NSpace, useDialog, useMessage } from 'naive-ui';
import { useAuthStore } from '../../stores/auth';
import { authApi } from '../../api/auth';

const message = useMessage();
const auth = useAuthStore();
const router = useRouter();
const dialog = useDialog();

const saving = ref(false);
const email = computed(() => auth.user?.email ?? '');
const name = ref(auth.user?.name ?? '');

const showChangePassword = ref(false);
const changingPassword = ref(false);
const changePasswordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

function reset() {
  name.value = auth.user?.name ?? '';
}

async function save() {
  saving.value = true;
  try {
    // 这里只做前端占位：后续接入用户更新 API
    message.success('已保存（占位）');
  } finally {
    saving.value = false;
  }
}

function openChangePassword() {
  changePasswordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  showChangePassword.value = true;
}

async function handleChangePassword() {
  const { oldPassword, newPassword, confirmPassword } = changePasswordForm.value;
  if (!oldPassword || !newPassword || !confirmPassword) {
    message.warning('请填写原密码、新密码与确认密码');
    return;
  }
  if (newPassword.length < 8) {
    message.warning('新密码至少需要 8 位');
    return;
  }
  if (newPassword !== confirmPassword) {
    message.warning('两次输入的新密码不一致');
    return;
  }
  if (oldPassword === newPassword) {
    message.warning('新密码不能与原密码相同');
    return;
  }

  changingPassword.value = true;
  try {
    const emailToPrefill = auth.user?.email ?? '';
    await authApi.changePassword(oldPassword, newPassword);
    await auth.logout();
    showChangePassword.value = false;

    dialog.success({
      title: '修改成功',
      content: '密码已修改，需要重新登录后继续使用。',
      positiveText: '去登录',
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
    message.error(e?.response?.data?.message ?? '修改密码失败');
  } finally {
    changingPassword.value = false;
  }
}
</script>

