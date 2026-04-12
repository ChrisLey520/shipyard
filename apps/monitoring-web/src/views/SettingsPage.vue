<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDataTable,
  NFormItem,
  NInput,
  NInputNumber,
  NLayout,
  NLayoutContent,
  NPageHeader,
  NSpace,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { createAlertRule, createProject, fetchAlertRules, fetchProjects, rotateProjectToken } from '../api';

const router = useRouter();
const message = useMessage();

const projects = ref<Array<{ id: string; projectKey: string; createdAt: string }>>([]);
const newProjectKey = ref('');
const rules = ref<
  Array<{
    id: string;
    name: string;
    eventType: string;
    windowMinutes: number;
    threshold: number;
    silenceMinutes: number;
    enabled: boolean;
    project: { projectKey: string };
    targets: Array<{ channel: string; webhookUrl: string }>;
  }>
>([]);

const alertForm = ref({
  projectKey: '',
  name: '错误突增',
  eventType: 'error',
  windowMinutes: 5,
  threshold: 10,
  silenceMinutes: 30,
  wecomUrl: '',
  feishuUrl: '',
});

async function loadProjects(): Promise<void> {
  const r = await fetchProjects();
  projects.value = r.items;
}

async function loadRules(): Promise<void> {
  rules.value = await fetchAlertRules();
}

onMounted(async () => {
  try {
    await loadProjects();
    await loadRules();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
});

const projectColumns: DataTableColumns<(typeof projects.value)[number]> = [
  { title: 'projectKey', key: 'projectKey' },
  { title: 'createdAt', key: 'createdAt', width: 220 },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    render(row) {
      return h('span', [
        h(
          NButton,
          {
            size: 'small',
            onClick: async () => {
              try {
                const t = await rotateProjectToken(row.id);
                message.success(`新 token 已生成（请保存）：${t.ingestToken.slice(0, 12)}…`);
                await loadProjects();
              } catch (e) {
                message.error(e instanceof Error ? e.message : String(e));
              }
            },
          },
          { default: () => '轮换 token' },
        ),
      ]);
    },
  },
];

async function onCreateProject(): Promise<void> {
  try {
    const p = await createProject(newProjectKey.value.trim());
    message.success(`已创建 ${p.projectKey}，ingestToken 请从响应或数据库查看（本页可再轮换）`);
    newProjectKey.value = '';
    await loadProjects();
    message.info(`ingestToken: ${p.ingestToken}`);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function onCreateAlert(): Promise<void> {
  const targets: Array<{ channel: 'wecom' | 'feishu'; webhookUrl: string }> = [];
  if (alertForm.value.wecomUrl.trim()) targets.push({ channel: 'wecom', webhookUrl: alertForm.value.wecomUrl.trim() });
  if (alertForm.value.feishuUrl.trim()) targets.push({ channel: 'feishu', webhookUrl: alertForm.value.feishuUrl.trim() });
  if (targets.length === 0) {
    message.warning('至少填写企微或飞书机器人 Webhook URL');
    return;
  }
  try {
    await createAlertRule({
      projectKey: alertForm.value.projectKey.trim(),
      name: alertForm.value.name,
      eventType: alertForm.value.eventType,
      windowMinutes: alertForm.value.windowMinutes,
      threshold: alertForm.value.threshold,
      silenceMinutes: alertForm.value.silenceMinutes,
      targets,
    });
    message.success('告警规则已创建');
    await loadRules();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

const ruleColumns: DataTableColumns<(typeof rules.value)[number]> = [
  { title: '项目', key: 'project', render: (r) => r.project.projectKey },
  { title: '名称', key: 'name' },
  { title: '类型', key: 'eventType', width: 100 },
  { title: '窗口(分)', key: 'windowMinutes', width: 90 },
  { title: '阈值', key: 'threshold', width: 70 },
  { title: '静默(分)', key: 'silenceMinutes', width: 90 },
  {
    title: '渠道',
    key: 'ch',
    render: (r) => r.targets.map((t) => t.channel).join(', '),
  },
];
</script>

<template>
  <n-layout>
    <n-layout-content style="padding: 24px; max-width: 900px; margin: 0 auto">
      <n-page-header title="项目与告警" @back="() => void router.push('/')" />
      <n-tabs type="line" style="margin-top: 16px">
        <n-tab-pane name="projects" tab="监控项目">
          <n-card title="新建项目">
            <n-space>
              <n-form-item label="projectKey">
                <n-input v-model:value="newProjectKey" placeholder="唯一键，如 my-app" style="width: 240px" />
              </n-form-item>
              <n-button type="primary" @click="() => void onCreateProject()">创建</n-button>
            </n-space>
          </n-card>
          <n-card style="margin-top: 16px" title="项目列表">
            <n-data-table :columns="projectColumns" :data="projects" :bordered="true" />
          </n-card>
        </n-tab-pane>
        <n-tab-pane name="alerts" tab="告警规则">
          <n-card title="新建规则（企微 / 飞书群机器人 Webhook）">
            <n-space vertical>
              <n-form-item label="projectKey">
                <n-input v-model:value="alertForm.projectKey" placeholder="与上表一致" style="width: 280px" />
              </n-form-item>
              <n-form-item label="规则名">
                <n-input v-model:value="alertForm.name" style="width: 280px" />
              </n-form-item>
              <n-form-item label="eventType">
                <n-input v-model:value="alertForm.eventType" style="width: 160px" />
              </n-form-item>
              <n-space>
                <n-form-item label="窗口(分钟)">
                  <n-input-number v-model:value="alertForm.windowMinutes" :min="1" :max="1440" />
                </n-form-item>
                <n-form-item label="阈值(条数)">
                  <n-input-number v-model:value="alertForm.threshold" :min="1" />
                </n-form-item>
                <n-form-item label="静默(分钟)">
                  <n-input-number v-model:value="alertForm.silenceMinutes" :min="1" />
                </n-form-item>
              </n-space>
              <n-form-item label="企微 Webhook">
                <n-input v-model:value="alertForm.wecomUrl" type="password" show-password-on="click" placeholder="https://qyapi.weixin.qq.com/..." style="width: 100%" />
              </n-form-item>
              <n-form-item label="飞书 Webhook">
                <n-input v-model:value="alertForm.feishuUrl" type="password" show-password-on="click" placeholder="https://open.feishu.cn/..." style="width: 100%" />
              </n-form-item>
              <n-button type="primary" @click="() => void onCreateAlert()">保存规则</n-button>
            </n-space>
          </n-card>
          <n-card style="margin-top: 16px" title="已有规则">
            <n-data-table :columns="ruleColumns" :data="rules" :bordered="true" />
          </n-card>
        </n-tab-pane>
      </n-tabs>
    </n-layout-content>
  </n-layout>
</template>
