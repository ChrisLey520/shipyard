<template>
  <view class="p-1">
    <wd-cell-group title="通知消息模板（项目级）" border>
      <wd-textarea v-model="templateDraft" placeholder="留空则用系统默认文案" />
      <wd-button block type="primary" size="small" class="mt-2" :loading="savingTpl" @click="saveTemplate">
        保存模板
      </wd-button>
    </wd-cell-group>

    <view class="flex justify-between items-center mt-4 mb-2">
      <text class="text-sm text-gray-600">通知渠道</text>
      <wd-button size="small" type="primary" @click="openCreateWebhook">新建 Webhook</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <view v-else>
      <view
        v-for="r in rows"
        :key="r.id"
        class="mb-2 p-3 rounded-lg bg-white border border-gray-200"
      >
        <view class="flex justify-between items-center gap-2">
          <text class="font-medium flex-1 min-w-0">{{ r.channel }}</text>
          <view class="shrink-0" @click.stop>
            <wd-switch
              :model-value="r.enabled"
              :disabled="togglingId === r.id"
              @update:model-value="(v: boolean | string | number) => onToggleNotification(r, Boolean(v))"
            />
          </view>
        </view>
        <text class="block text-xs text-gray-600 mt-1">事件: {{ formatEvents(r.events) }}</text>
        <view class="flex gap-2 mt-2">
          <wd-button
            v-if="String(r.channel) === 'webhook'"
            size="small"
            plain
            @click="openEditWebhook(r)"
          >
            编辑
          </wd-button>
          <wd-button size="small" plain type="error" @click="removeRow(r.id)">删除</wd-button>
        </view>
      </view>
    </view>
    <view v-if="!loading && !rows.length" class="text-center text-gray-500 py-4">暂无通知配置</view>

    <wd-popup v-model="showWh" position="bottom" :safe-area-inset-bottom="true">
      <scroll-view scroll-y class="max-h-85vh p-4">
        <wd-input v-model="wh.url" label="Webhook URL" placeholder="https://..." />
        <wd-input v-model="wh.secret" label="Secret" show-password placeholder="可选" />
        <view class="text-sm text-gray-600 mt-3 mb-1">订阅事件</view>
        <wd-checkbox-group v-model="wh.events" shape="square" inline>
          <wd-checkbox v-for="ev in eventOptions" :key="ev" :model-value="ev">{{ ev }}</wd-checkbox>
        </wd-checkbox-group>
        <view class="flex items-center mt-2">
          <text class="text-sm mr-2">启用</text>
          <wd-switch v-model="wh.enabled" />
        </view>
        <wd-button block type="primary" class="mt-4" :loading="savingWh" @click="submitWebhook">保存</wd-button>
        <wd-button block plain class="mt-2" @click="showWh = false">取消</wd-button>
      </scroll-view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { NotificationChannel, NotificationEvent } from '@shipyard/shared';
import * as projectsApi from '@/api/projects';
import * as notifApi from '@/api/projects/notifications';
import type { ProjectNotificationRow } from '@/api/projects/notifications';

const props = defineProps<{ orgSlug: string; projectSlug: string }>();

const emit = defineEmits<{ refreshProject: [] }>();

const loading = ref(false);
const rows = ref<ProjectNotificationRow[]>([]);
const templateDraft = ref('');
const savingTpl = ref(false);
const showWh = ref(false);
const savingWh = ref(false);
const editingWhId = ref<string | null>(null);
const togglingId = ref<string | null>(null);

const eventOptions = Object.values(NotificationEvent);

const wh = ref({
  url: '',
  secret: '',
  events: [] as string[],
  enabled: true,
});

function formatEvents(ev: ProjectNotificationRow['events']) {
  if (Array.isArray(ev)) return ev.join(', ');
  return String(ev);
}

async function load() {
  if (!props.orgSlug || !props.projectSlug) return;
  loading.value = true;
  try {
    const p = await projectsApi.getProject(props.orgSlug, props.projectSlug);
    templateDraft.value = p.notificationMessageTemplate ?? '';
    rows.value = await notifApi.listProjectNotifications(props.orgSlug, props.projectSlug);
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.orgSlug, props.projectSlug],
  () => void load(),
  { immediate: true },
);

async function saveTemplate() {
  savingTpl.value = true;
  try {
    await projectsApi.updateProject(props.orgSlug, props.projectSlug, {
      notificationMessageTemplate: templateDraft.value.trim() || null,
    });
    uni.showToast({ title: '已保存', icon: 'success' });
    emit('refreshProject');
  } catch {
    // 全局 request 已提示
  } finally {
    savingTpl.value = false;
  }
}

async function onToggleNotification(row: ProjectNotificationRow, enabled: boolean) {
  if (row.enabled === enabled) return;
  togglingId.value = row.id;
  try {
    await notifApi.updateProjectNotification(props.orgSlug, props.projectSlug, row.id, { enabled });
    uni.showToast({ title: enabled ? '已启用' : '已停用', icon: 'success' });
    await load();
  } catch {
    // 全局 request 已提示
  } finally {
    togglingId.value = null;
  }
}

function openCreateWebhook() {
  editingWhId.value = null;
  wh.value = { url: '', secret: '', events: [NotificationEvent.BUILD_FAILED], enabled: true };
  showWh.value = true;
}

function openEditWebhook(r: ProjectNotificationRow) {
  editingWhId.value = r.id;
  const cfg = r.config as { url?: string; secret?: string };
  const evs = Array.isArray(r.events) ? r.events.map(String) : [];
  wh.value = {
    url: String(cfg.url ?? ''),
    secret: '',
    events: evs.length ? evs : [],
    enabled: r.enabled,
  };
  showWh.value = true;
}

async function submitWebhook() {
  if (!wh.value.url.trim()) {
    uni.showToast({ title: '请填写 Webhook URL', icon: 'none' });
    return;
  }
  if (!wh.value.events.length) {
    uni.showToast({ title: '请至少选一个事件', icon: 'none' });
    return;
  }
  const events = wh.value.events as NotificationEvent[];
  const config: Record<string, unknown> = { url: wh.value.url.trim() };
  if (wh.value.secret.trim()) config.secret = wh.value.secret.trim();

  savingWh.value = true;
  try {
    if (editingWhId.value) {
      await notifApi.updateProjectNotification(
        props.orgSlug,
        props.projectSlug,
        editingWhId.value,
        {
          events,
          enabled: wh.value.enabled,
          config,
        },
      );
    } else {
      await notifApi.createProjectNotification(props.orgSlug, props.projectSlug, {
        channel: NotificationChannel.WEBHOOK,
        events,
        config,
        enabled: wh.value.enabled,
      });
    }
    uni.showToast({ title: '已保存', icon: 'success' });
    showWh.value = false;
    await load();
  } catch {
    // 全局 request 已提示
  } finally {
    savingWh.value = false;
  }
}

function removeRow(id: string) {
  uni.showModal({
    title: '删除',
    content: '确定删除该通知配置？',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await notifApi.deleteProjectNotification(props.orgSlug, props.projectSlug, id);
        uni.showToast({ title: '已删除', icon: 'success' });
        await load();
      } catch {
        // 全局 request 已提示
      }
    },
  });
}
</script>
