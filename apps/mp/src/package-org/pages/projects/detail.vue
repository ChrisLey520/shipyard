<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <wd-loading v-if="loading && !project" />
    <view v-else-if="project">
      <view class="flex flex-wrap gap-2 mb-3">
        <wd-button
          v-for="t in tabDefs"
          :key="t.k"
          size="small"
          :plain="activeTab !== t.k"
          :type="activeTab === t.k ? 'primary' : 'default'"
          @click="activeTab = t.k"
        >
          {{ t.label }}
        </wd-button>
      </view>

      <!-- 概览 -->
      <view v-show="activeTab === 'overview'">
        <view class="flex flex-wrap gap-2 mb-3">
          <wd-button size="small" type="primary" @click="showEdit = true">编辑项目</wd-button>
          <wd-button size="small" plain @click="showBuildEnv = true">构建变量</wd-button>
        </view>

        <wd-cell-group title="基础" border>
          <wd-cell title="名称" :value="project.name" />
          <wd-cell title="Slug" :value="project.slug" />
          <wd-cell title="仓库" :value="project.repoFullName" />
          <wd-cell title="框架" :value="project.frameworkType" />
          <wd-cell title="创建时间" :value="formatTime(project.createdAt)" />
        </wd-cell-group>

        <wd-cell-group title="Git 连接" border custom-class="mt-3">
          <wd-cell title="Provider" :value="project.gitConnection?.gitProvider ?? '—'" />
          <wd-cell title="用户" :value="project.gitConnection?.gitUsername ?? '—'" />
          <wd-cell title="状态" :value="project.gitConnection ? '已绑定' : '未绑定'" />
        </wd-cell-group>

        <wd-cell-group v-if="project.pipelineConfig" title="构建配置" border custom-class="mt-3">
          <wd-cell title="Node" :value="project.pipelineConfig.nodeVersion" />
          <wd-cell title="安装" :value="project.pipelineConfig.installCommand" />
          <wd-cell title="构建" :value="project.pipelineConfig.buildCommand" />
          <wd-cell title="输出" :value="project.pipelineConfig.outputDir" />
        </wd-cell-group>

        <wd-cell-group
          v-if="project.gitConnection?.gitProvider === 'github'"
          title="PR 预览"
          border
          custom-class="mt-3"
        >
          <wd-cell title="状态" :value="project.previewEnabled ? '已启用' : '未启用'" />
          <wd-cell title="服务器" :value="project.previewServer?.name ?? '—'" />
          <wd-cell title="父域" :value="project.previewBaseDomain ?? '—'" />
        </wd-cell-group>

        <view class="flex justify-between items-center mt-4 mb-2">
          <text class="text-sm font-medium">部署记录</text>
          <wd-button size="small" type="primary" plain @click="openDeploySheet">触发部署</wd-button>
        </view>
        <wd-cell-group border>
          <wd-cell
            v-for="d in deployments"
            :key="d.id"
            :title="d.branch"
            :label="`${d.status} · ${formatTime(d.createdAt)}`"
            is-link
            @click="openDep(d.id)"
          />
        </wd-cell-group>
        <view v-if="!deployments.length" class="text-center text-gray-500 py-4">暂无部署</view>
      </view>

      <!-- 环境 -->
      <view v-show="activeTab === 'env'">
        <view class="flex flex-wrap gap-2 mb-3">
          <wd-button size="small" type="primary" plain @click="goEnvs">环境管理</wd-button>
        </view>
        <view v-if="!project.environments.length" class="text-center text-gray-500 py-6">
          <text class="block mb-3">还没有部署环境</text>
          <wd-button size="small" type="primary" @click="goEnvs">去创建环境</wd-button>
        </view>
        <view v-else>
          <view
            v-for="e in project.environments"
            :key="e.id"
            class="mb-3 border border-gray-200 rounded-lg p-3 bg-white"
          >
            <text class="font-medium text-base block">{{ e.name }}</text>
            <view class="flex flex-wrap gap-2 mt-2">
              <text class="text-xs px-2 py-0.5 bg-gray-100 rounded">{{ e.triggerBranch }}</text>
              <text
                class="text-xs px-2 py-0.5 rounded"
                :class="e.protected ? 'bg-red-100 text-red-700' : 'bg-gray-100'"
              >
                {{ e.protected ? '受保护' : '开放' }}
              </text>
            </view>
            <text class="text-xs text-gray-500 block mt-2">
              {{ e.server.name }}（{{ e.server.host }}）· {{ e.deployPath }}
            </text>
            <text v-if="e.accessUrl" class="text-xs text-primary block mt-1 break-all">访问：{{ e.accessUrl }}</text>
            <view class="flex flex-wrap gap-2 mt-3 justify-end">
              <wd-button size="small" type="primary" @click="doDeploy(e.id)">立即部署</wd-button>
              <wd-button size="small" plain @click="goEnvs">编辑</wd-button>
            </view>
          </view>
        </view>
      </view>

      <!-- 部署 -->
      <view v-show="activeTab === 'deploy'">
        <view class="flex justify-end mb-2">
          <wd-button size="small" type="primary" plain @click="openDeploySheet">触发部署</wd-button>
        </view>
        <wd-cell-group border>
          <wd-cell
            v-for="d in deployments"
            :key="d.id"
            :title="d.branch"
            :label="`${d.status} · ${formatTime(d.createdAt)}`"
            is-link
            @click="openDep(d.id)"
          />
        </wd-cell-group>
        <view v-if="!deployments.length" class="text-center text-gray-500 py-8">暂无部署</view>
      </view>

      <ProjectNotificationsTab
        v-show="activeTab === 'notify'"
        :org-slug="orgSlug"
        :project-slug="projectSlug"
        @refresh-project="reloadProjectOnly"
      />
      <ProjectFeatureFlagsTab
        v-show="activeTab === 'flags'"
        :org-slug="orgSlug"
        :project-slug="projectSlug"
      />
    </view>

    <wd-action-sheet
      v-model="showDeploy"
      :actions="envActions"
      cancel-text="取消"
      @select="onDeploySheetSelect"
    />

    <ProjectEditPopup
      v-model="showEdit"
      :org-slug="orgSlug"
      :project-slug="projectSlug"
      :project="project"
      @saved="onProjectSaved"
    />

    <wd-popup v-model="showBuildEnv" position="bottom" :safe-area-inset-bottom="true">
      <scroll-view scroll-y class="max-h-70vh p-4">
        <text class="font-medium">构建环境变量</text>
        <view v-for="v in buildEnvVars" :key="v.id" class="flex justify-between items-center mt-2 py-2 border-b">
          <text>{{ v.key }}</text>
          <wd-button size="small" plain type="error" @click="removeBuildEnv(v.id)">删</wd-button>
        </view>
        <wd-input v-model="newEnv.key" class="mt-3" label="KEY" placeholder="VAR_NAME" />
        <wd-input v-model="newEnv.value" label="VALUE" show-password />
        <wd-button block type="primary" class="mt-2" :loading="envSaving" @click="addBuildEnv">添加</wd-button>
        <wd-button block plain class="mt-2" @click="showBuildEnv = false">关闭</wd-button>
      </scroll-view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useProjectPageContext } from '@/composables/useProjectPageContext';
import * as projectsApi from '@/api/projects';
import type { ProjectDetail, DeploymentListItem, ProjectBuildEnvVar } from '@/api/projects';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';
import ProjectEditPopup from '@/package-org/components/ProjectEditPopup.vue';
import ProjectNotificationsTab from '@/package-org/components/ProjectNotificationsTab.vue';
import ProjectFeatureFlagsTab from '@/package-org/components/ProjectFeatureFlagsTab.vue';

const tabDefs = [
  { k: 'overview' as const, label: '概览' },
  { k: 'env' as const, label: '环境' },
  { k: 'deploy' as const, label: '部署' },
  { k: 'notify' as const, label: '通知' },
  { k: 'flags' as const, label: '特性' },
];

const activeTab = ref<(typeof tabDefs)[number]['k']>('overview');
const { orgSlug, projectSlug, initProjectFromQuery } = useProjectPageContext();
const loading = ref(true);
const project = ref<ProjectDetail | null>(null);
const deployments = ref<DeploymentListItem[]>([]);
const showDeploy = ref(false);
const showEdit = ref(false);
const showBuildEnv = ref(false);
const buildEnvVars = ref<ProjectBuildEnvVar[]>([]);
const newEnv = ref({ key: '', value: '' });
const envSaving = ref(false);

const envActions = computed(() =>
  (project.value?.environments ?? []).map((e) => ({
    name: `${e.name}（${e.triggerBranch}）`,
    envId: e.id,
  })) as Array<{ name: string; envId: string }>,
);

onLoad((q) => {
  initProjectFromQuery(q as Record<string, string | undefined>);
});

async function loadAll() {
  if (!orgSlug.value || !projectSlug.value) return;
  loading.value = true;
  try {
    const [p, deps] = await Promise.all([
      projectsApi.getProject(orgSlug.value, projectSlug.value),
      projectsApi.listDeployments(orgSlug.value, projectSlug.value),
    ]);
    project.value = p;
    deployments.value = deps;
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

async function reloadProjectOnly() {
  if (!orgSlug.value || !projectSlug.value) return;
  try {
    project.value = await projectsApi.getProject(orgSlug.value, projectSlug.value);
  } catch {
    // 全局 request 已提示
  }
}

watch([orgSlug, projectSlug], loadAll, { immediate: true });

watch(showBuildEnv, async (open) => {
  if (!open || !orgSlug.value || !projectSlug.value) return;
  try {
    buildEnvVars.value = await projectsApi.listProjectBuildEnv(orgSlug.value, projectSlug.value);
  } catch {
    buildEnvVars.value = [];
  }
});

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function goEnvs() {
  uni.navigateTo({
    url: `/package-org/pages/projects/environments?orgSlug=${encodeURIComponent(orgSlug.value)}&projectSlug=${encodeURIComponent(projectSlug.value)}`,
  });
}

function openDep(id: string) {
  uni.navigateTo({
    url: `/package-org/pages/projects/deployment-detail?orgSlug=${encodeURIComponent(orgSlug.value)}&projectSlug=${encodeURIComponent(projectSlug.value)}&deploymentId=${encodeURIComponent(id)}`,
  });
}

function openDeploySheet() {
  if (!envActions.value.length) {
    uni.showToast({ title: '请先创建环境', icon: 'none' });
    return;
  }
  showDeploy.value = true;
}

function onDeploySheetSelect(payload: { item: { name: string; envId?: string } }) {
  const envId = payload.item.envId;
  if (!envId) return;
  void doDeploy(envId);
}

async function doDeploy(environmentId: string) {
  try {
    await projectsApi.triggerDeploy(orgSlug.value, projectSlug.value, { environmentId });
    uni.showToast({ title: '已触发', icon: 'success' });
    deployments.value = await projectsApi.listDeployments(orgSlug.value, projectSlug.value);
  } catch {
    // 全局 request 已提示
  }
}

function onProjectSaved(payload: { slugChanged: boolean; newSlug: string }) {
  if (payload.slugChanged) {
    uni.redirectTo({
      url: `/package-org/pages/projects/detail?orgSlug=${encodeURIComponent(orgSlug.value)}&projectSlug=${encodeURIComponent(payload.newSlug)}`,
    });
  } else {
    void loadAll();
  }
}

async function addBuildEnv() {
  if (!newEnv.value.key.trim() || !newEnv.value.value) {
    uni.showToast({ title: '请填写 KEY 与 VALUE', icon: 'none' });
    return;
  }
  envSaving.value = true;
  try {
    await projectsApi.upsertProjectBuildEnv(orgSlug.value, projectSlug.value, {
      key: newEnv.value.key.trim(),
      value: newEnv.value.value,
    });
    newEnv.value = { key: '', value: '' };
    buildEnvVars.value = await projectsApi.listProjectBuildEnv(orgSlug.value, projectSlug.value);
    uni.showToast({ title: '已添加', icon: 'success' });
  } catch {
    // 全局 request 已提示
  } finally {
    envSaving.value = false;
  }
}

async function removeBuildEnv(id: string) {
  try {
    await projectsApi.deleteProjectBuildEnv(orgSlug.value, projectSlug.value, id);
    buildEnvVars.value = await projectsApi.listProjectBuildEnv(orgSlug.value, projectSlug.value);
    uni.showToast({ title: '已删除', icon: 'success' });
  } catch {
    // 全局 request 已提示
  }
}
</script>
