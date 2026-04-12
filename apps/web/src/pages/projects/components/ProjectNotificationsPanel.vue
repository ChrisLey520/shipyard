<template>
  <div class="mt-2 flex flex-col gap-4">
    <n-card title="通知消息模板（项目级）" size="small">
      <n-text depth="3" class="mb-2 block text-sm">
        {{ templateHelpText }}
      </n-text>
      <n-input
        v-model:value="msgTemplateDraft"
        type="textarea"
        :rows="4"
        :placeholder="templatePlaceholder"
      />
      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <n-button size="small" @click="resetTemplateDraft">还原</n-button>
        <n-button type="primary" size="small" :loading="savingTemplate" @click="saveTemplate">
          保存模板
        </n-button>
      </div>
    </n-card>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <n-text depth="3" class="text-sm">
        构建/部署/审批事件将按下方配置入队并由 Worker 发送；敏感字段仅保存密文，列表中不展示。
      </n-text>
      <n-button type="primary" size="small" @click="openCreate">新建通知</n-button>
    </div>

    <n-data-table
      size="small"
      :columns="columns"
      :data="rows"
      :loading="loading"
      :row-key="(r: ProjectNotificationRow) => r.id"
      :pagination="{ pageSize: 10 }"
    />

    <n-modal
      v-model:show="modalShow"
      preset="card"
      :title="editingId ? '编辑通知' : '新建通知'"
      class="w-full max-w-[720px]"
      :mask-closable="false"
    >
      <n-form :model="form" label-placement="left" label-width="auto" class="w-full max-w-full">
        <n-form-item label="渠道">
          <n-select
            v-model:value="form.channel"
            :options="channelOptions"
            :disabled="Boolean(editingId)"
            @update:value="onChannelChange"
          />
        </n-form-item>
        <n-form-item label="事件">
          <n-select
            v-model:value="form.events"
            multiple
            :options="eventOptions"
            placeholder="至少选一个事件"
          />
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>

        <template v-if="isUrlChannel">
          <n-form-item label="URL" required>
            <n-input v-model:value="form.url" placeholder="https://..." />
          </n-form-item>
          <n-form-item :label="secretLabel">
            <n-input
              v-model:value="form.secret"
              type="password"
              show-password-on="click"
              :placeholder="secretPlaceholder"
            />
          </n-form-item>
        </template>

        <template v-else-if="form.channel === NotificationChannel.EMAIL">
          <n-form-item label="SMTP 主机" required>
            <n-input v-model:value="form.smtpHost" />
          </n-form-item>
          <n-form-item label="端口" required>
            <n-input-number v-model:value="form.smtpPort" :min="1" :max="65535" class="w-full" />
          </n-form-item>
          <n-form-item label="TLS">
            <n-switch v-model:value="form.smtpSecure" />
          </n-form-item>
          <n-form-item label="用户名" required>
            <n-input v-model:value="form.smtpUser" />
          </n-form-item>
          <n-form-item label="密码">
            <n-input
              v-model:value="form.smtpPass"
              type="password"
              show-password-on="click"
              :placeholder="smtpPassPlaceholder"
            />
          </n-form-item>
          <n-form-item label="发件人 From" required>
            <n-input v-model:value="form.from" placeholder="Shipyard &lt;no-reply@example.com&gt;" />
          </n-form-item>
          <n-form-item label="收件人 To（可选）">
            <n-input v-model:value="form.to" placeholder="默认发到 SMTP 用户名" />
          </n-form-item>
        </template>
      </n-form>

      <div class="mt-4 flex justify-end gap-2">
        <n-button @click="modalShow = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="submit">保存</n-button>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSwitch,
  NTag,
  NText,
  useDialog,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { useQueryClient } from '@tanstack/vue-query';
import { NotificationChannel, NotificationEvent } from '@shipyard/shared';
import {
  createProjectNotification,
  deleteProjectNotification,
  updateProjectNotification,
  type ProjectNotificationRow,
} from '@/api/projects/notifications';
import { updateProject } from '@/api/projects';
import { useProjectDetailQuery } from '@/composables/projects/useProjectDetailQuery';
import { useProjectNotificationsQuery } from '@/composables/projects/useProjectNotificationsQuery';

const props = defineProps<{
  orgSlug: string;
  projectSlug: string;
}>();

/** 占位符说明（整段在脚本里拼接，避免模板中 `}}` 提前结束插值） */
const templateHelpText =
  '留空则使用各事件的系统默认文案。填写后整段作为骨架，仍走占位符渲染；可用 {{projectSlug}}、{{orgSlug}}、{{event}}、{{detailUrl}}、{{deploymentId}}、{{approvalId}}，以及 {{message}}（或 {{body}}，表示系统默认那句全文）。';

/** 占位符示例（避免在属性里写 `{{` 被 Vue 当成插值） */
const templatePlaceholder = '示例：[{{orgSlug}}/{{projectSlug}}] {{event}}：{{message}}';

const message = useMessage();
const dialog = useDialog();
const queryClient = useQueryClient();

const orgSlugRef = computed(() => props.orgSlug);
const projectSlugRef = computed(() => props.projectSlug);
const detailQ = useProjectDetailQuery(orgSlugRef, projectSlugRef);
const q = useProjectNotificationsQuery(orgSlugRef, projectSlugRef);
const rows = computed(() => q.data.value ?? []);
const loading = computed(() => q.isPending.value || q.isFetching.value);

const EVENT_LABELS: Record<NotificationEvent, string> = {
  [NotificationEvent.BUILD_SUCCESS]: '构建成功',
  [NotificationEvent.BUILD_FAILED]: '构建失败',
  [NotificationEvent.DEPLOY_SUCCESS]: '部署成功',
  [NotificationEvent.DEPLOY_FAILED]: '部署失败',
  [NotificationEvent.APPROVAL_PENDING]: '待审批',
  [NotificationEvent.APPROVAL_APPROVED]: '审批通过',
  [NotificationEvent.APPROVAL_REJECTED]: '审批拒绝',
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  [NotificationChannel.WEBHOOK]: 'Webhook',
  [NotificationChannel.EMAIL]: '邮件',
  [NotificationChannel.FEISHU]: '飞书',
  [NotificationChannel.DINGTALK]: '钉钉',
  [NotificationChannel.SLACK]: 'Slack',
  [NotificationChannel.WECOM]: '企业微信',
};

const channelOptions = Object.values(NotificationChannel).map((v) => ({
  label: CHANNEL_LABELS[v],
  value: v,
}));

const eventOptions = Object.values(NotificationEvent).map((v) => ({
  label: EVENT_LABELS[v],
  value: v,
}));

const msgTemplateDraft = ref('');
const savingTemplate = ref(false);

watch(
  () => detailQ.data.value?.notificationMessageTemplate,
  (t) => {
    msgTemplateDraft.value = t ?? '';
  },
  { immediate: true },
);

function resetTemplateDraft() {
  msgTemplateDraft.value = detailQ.data.value?.notificationMessageTemplate ?? '';
}

async function saveTemplate() {
  const v = msgTemplateDraft.value.trim();
  savingTemplate.value = true;
  try {
    await updateProject(props.orgSlug, props.projectSlug, {
      notificationMessageTemplate: v === '' ? null : v,
    });
    message.success('已保存');
    await queryClient.invalidateQueries({
      queryKey: ['projects', 'detail', props.orgSlug, props.projectSlug],
    });
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    savingTemplate.value = false;
  }
}

const modalShow = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const form = ref({
  channel: NotificationChannel.WEBHOOK as NotificationChannel,
  events: [] as NotificationEvent[],
  enabled: true,
  url: '',
  secret: '',
  smtpHost: '',
  smtpPort: 587 as number | null,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  from: '',
  to: '',
});

const isUrlChannel = computed(() =>
  [
    NotificationChannel.WEBHOOK,
    NotificationChannel.FEISHU,
    NotificationChannel.DINGTALK,
    NotificationChannel.SLACK,
    NotificationChannel.WECOM,
  ].includes(form.value.channel),
);

const secretLabel = computed(() =>
  form.value.channel === NotificationChannel.WEBHOOK || form.value.channel === NotificationChannel.WECOM
    ? 'Secret（可选）'
    : '签名 Secret（可选）',
);

const secretPlaceholder = computed(() =>
  editingId.value ? '留空保留原值' : '无则留空',
);

const smtpPassPlaceholder = computed(() =>
  editingId.value ? '留空保留原密码' : '发信密码',
);

function resetForm() {
  form.value = {
    channel: NotificationChannel.WEBHOOK,
    events: [],
    enabled: true,
    url: '',
    secret: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    from: '',
    to: '',
  };
}

function onChannelChange() {
  form.value.url = '';
  form.value.secret = '';
  form.value.smtpHost = '';
  form.value.smtpPort = 587;
  form.value.smtpSecure = false;
  form.value.smtpUser = '';
  form.value.smtpPass = '';
  form.value.from = '';
  form.value.to = '';
}

function openCreate() {
  editingId.value = null;
  resetForm();
  modalShow.value = true;
}

function fillFormFromRow(row: ProjectNotificationRow) {
  editingId.value = row.id;
  const c = row.config;
  form.value.channel = row.channel as NotificationChannel;
  form.value.events = (row.events ?? []) as NotificationEvent[];
  form.value.enabled = row.enabled;
  form.value.url = typeof c['url'] === 'string' ? c['url'] : '';
  form.value.secret = '';
  form.value.smtpHost = typeof c['smtpHost'] === 'string' ? c['smtpHost'] : '';
  form.value.smtpPort = typeof c['smtpPort'] === 'number' ? c['smtpPort'] : Number(c['smtpPort']) || 587;
  form.value.smtpSecure = Boolean(c['smtpSecure']);
  form.value.smtpUser = typeof c['smtpUser'] === 'string' ? c['smtpUser'] : '';
  form.value.smtpPass = '';
  form.value.from = typeof c['from'] === 'string' ? c['from'] : '';
  form.value.to = typeof c['to'] === 'string' ? c['to'] : '';
}

function openEdit(row: ProjectNotificationRow) {
  fillFormFromRow(row);
  modalShow.value = true;
}

function buildConfig(): Record<string, unknown> {
  const ch = form.value.channel;
  if (
    ch === NotificationChannel.WEBHOOK ||
    ch === NotificationChannel.FEISHU ||
    ch === NotificationChannel.DINGTALK ||
    ch === NotificationChannel.SLACK ||
    ch === NotificationChannel.WECOM
  ) {
    const o: Record<string, unknown> = { url: form.value.url.trim() };
    if (form.value.secret.trim()) {
      o.secret = form.value.secret.trim();
    }
    return o;
  }
  const o: Record<string, unknown> = {
    smtpHost: form.value.smtpHost.trim(),
    smtpPort: form.value.smtpPort ?? 587,
    smtpSecure: form.value.smtpSecure,
    smtpUser: form.value.smtpUser.trim(),
    from: form.value.from.trim(),
  };
  if (form.value.smtpPass.trim()) {
    o.smtpPass = form.value.smtpPass.trim();
  }
  if (form.value.to.trim()) {
    o.to = form.value.to.trim();
  }
  return o;
}

async function submit() {
  if (!form.value.events.length) {
    message.warning('请至少选择一个事件');
    return;
  }
  if (isUrlChannel.value && !form.value.url.trim()) {
    message.warning('请填写 URL');
    return;
  }
  if (form.value.channel === NotificationChannel.EMAIL) {
    if (!form.value.smtpHost.trim() || !form.value.smtpUser.trim() || !form.value.from.trim()) {
      message.warning('请填写 SMTP 主机、用户名与发件人');
      return;
    }
    if (!editingId.value && !form.value.smtpPass.trim()) {
      message.warning('新建邮件通知时请填写 SMTP 密码');
      return;
    }
  }

  const config = buildConfig();
  saving.value = true;
  try {
    if (editingId.value) {
      const patch: Record<string, unknown> = {
        events: form.value.events,
        enabled: form.value.enabled,
        config,
      };
      if (isUrlChannel.value && !form.value.secret.trim()) {
        (patch.config as Record<string, unknown>).secret = '';
      }
      if (form.value.channel === NotificationChannel.EMAIL && !form.value.smtpPass.trim()) {
        (patch.config as Record<string, unknown>).smtpPass = '';
      }
      await updateProjectNotification(props.orgSlug, props.projectSlug, editingId.value, patch);
      message.success('已更新');
    } else {
      await createProjectNotification(props.orgSlug, props.projectSlug, {
        channel: form.value.channel,
        events: form.value.events,
        enabled: form.value.enabled,
        config,
      });
      message.success('已创建');
    }
    modalShow.value = false;
    await queryClient.invalidateQueries({
      queryKey: ['projects', 'notifications', props.orgSlug, props.projectSlug],
    });
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    saving.value = false;
  }
}

function confirmDelete(row: ProjectNotificationRow) {
  dialog.warning({
    title: '删除此通知配置？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await deleteProjectNotification(props.orgSlug, props.projectSlug, row.id);
      message.success('已删除');
      await queryClient.invalidateQueries({
        queryKey: ['projects', 'notifications', props.orgSlug, props.projectSlug],
      });
    },
  });
}

const togglingNotifId = ref<string | null>(null);

async function toggleNotificationEnabled(row: ProjectNotificationRow, enabled: boolean) {
  if (row.enabled === enabled) return;
  togglingNotifId.value = row.id;
  try {
    await updateProjectNotification(props.orgSlug, props.projectSlug, row.id, { enabled });
    message.success(enabled ? '已启用' : '已关闭');
    await queryClient.invalidateQueries({
      queryKey: ['projects', 'notifications', props.orgSlug, props.projectSlug],
    });
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    togglingNotifId.value = null;
  }
}

const columns = computed<DataTableColumns<ProjectNotificationRow>>(() => [
  {
    title: '渠道',
    key: 'channel',
    width: 100,
    render: (r) => CHANNEL_LABELS[r.channel as NotificationChannel] ?? r.channel,
  },
  {
    title: '事件',
    key: 'events',
    ellipsis: { tooltip: true },
    render: (r) =>
      h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        (r.events ?? []).map((ev) =>
          h(NTag, { size: 'small' }, { default: () => EVENT_LABELS[ev as NotificationEvent] ?? ev }),
        ),
      ),
  },
  {
    title: '启用',
    key: 'enabled',
    width: 96,
    render: (r) =>
      h(NSwitch, {
        value: r.enabled,
        loading: togglingNotifId.value === r.id,
        disabled: togglingNotifId.value === r.id,
        onUpdateValue: (v: boolean) => void toggleNotificationEnabled(r, v),
      }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    render: (r) =>
      h('div', { class: 'flex flex-wrap gap-2' }, [
        h(NButton, { size: 'tiny', onClick: () => openEdit(r) }, { default: () => '编辑' }),
        h(
          NButton,
          { size: 'tiny', type: 'error', secondary: true, onClick: () => confirmDelete(r) },
          { default: () => '删除' },
        ),
      ]),
  },
]);

watch(
  () => props.projectSlug,
  () => {
    void q.refetch();
  },
);
</script>
