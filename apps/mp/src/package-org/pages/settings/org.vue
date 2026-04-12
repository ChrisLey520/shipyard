<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <wd-loading v-if="loading" />
    <view v-else-if="form">
      <wd-cell-group title="Kubernetes 集群" border>
        <wd-button size="small" type="primary" custom-class="mb-2" @click="openK8s">登记集群</wd-button>
        <view
          v-for="c in k8sClusters"
          :key="c.id"
          class="flex justify-between items-center py-2 border-b border-gray-100"
        >
          <text>{{ c.name }}</text>
          <wd-button size="small" plain type="error" @click="removeK8s(c.id)">删除</wd-button>
        </view>
        <view v-if="!k8sClusters.length" class="text-gray-500 text-sm py-2">暂无集群</view>
      </wd-cell-group>

      <wd-cell-group title="组织级特性开关" border custom-class="mt-3">
        <OrgFeatureFlagsBlock :org-slug="orgSlug" />
      </wd-cell-group>

      <wd-cell-group title="基本信息" border custom-class="mt-3">
        <wd-input v-model="form.name" label="组织名称" />
        <wd-input v-model="form.slug" label="URL 标识" placeholder="小写字母、数字、连字符" />
        <wd-input v-model="buildConcurrencyStr" label="并行构建数" type="number" @blur="syncConcurrency" />
        <wd-input v-model="retentionStr" label="产物保留数量" type="number" @blur="syncRetention" />
      </wd-cell-group>
      <wd-button block type="primary" class="mt-4" :loading="saving" @click="save">保存</wd-button>
    </view>

    <wd-popup v-model="showK8s" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <wd-input v-model="k8sForm.name" label="名称" placeholder="如 prod-eks" />
        <wd-textarea v-model="k8sForm.kubeconfig" label="Kubeconfig" placeholder="粘贴 YAML" />
        <wd-button block type="primary" class="mt-3" :loading="k8sSaving" @click="saveK8s">保存</wd-button>
        <wd-button block plain class="mt-2" @click="showK8s = false">取消</wd-button>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { URL_SLUG_VALIDATION_MESSAGE, isValidUrlSlug } from '@shipyard/shared';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import { useOrgStore } from '@/stores/org';
import * as settingsApi from '@/api/settings';
import type { OrgSettings } from '@/api/settings';
import * as k8sApi from '@/api/kubernetes-clusters';
import type { KubernetesClusterRow } from '@/api/kubernetes-clusters';
import { HttpError } from '@/api/http';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';
import OrgFeatureFlagsBlock from '@/package-org/components/OrgFeatureFlagsBlock.vue';

const orgStore = useOrgStore();
const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const loading = ref(false);
const saving = ref(false);
const form = ref<OrgSettings | null>(null);
const buildConcurrencyStr = ref('');
const retentionStr = ref('');
const k8sClusters = ref<KubernetesClusterRow[]>([]);
const showK8s = ref(false);
const k8sSaving = ref(false);
const k8sForm = ref({ name: '', kubeconfig: '' });

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

async function loadK8s() {
  if (!orgSlug.value) return;
  try {
    k8sClusters.value = await k8sApi.listKubernetesClusters(orgSlug.value);
  } catch {
    k8sClusters.value = [];
  }
}

watch(
  orgSlug,
  async (s) => {
    if (!s) return;
    loading.value = true;
    try {
      const o = await settingsApi.getOrg(s);
      form.value = o;
      buildConcurrencyStr.value = String(o.buildConcurrency);
      retentionStr.value = String(o.artifactRetention);
      await loadK8s();
    } catch (e) {
      uni.showToast({ title: e instanceof HttpError ? e.message : '加载失败', icon: 'none' });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function openK8s() {
  k8sForm.value = { name: '', kubeconfig: '' };
  showK8s.value = true;
}

async function saveK8s() {
  if (!k8sForm.value.name.trim() || !k8sForm.value.kubeconfig.trim()) {
    uni.showToast({ title: '请填写名称与 kubeconfig', icon: 'none' });
    return;
  }
  k8sSaving.value = true;
  try {
    await k8sApi.createKubernetesCluster(orgSlug.value, {
      name: k8sForm.value.name.trim(),
      kubeconfig: k8sForm.value.kubeconfig.trim(),
    });
    uni.showToast({ title: '已保存', icon: 'success' });
    showK8s.value = false;
    await loadK8s();
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
  } finally {
    k8sSaving.value = false;
  }
}

function removeK8s(id: string) {
  uni.showModal({
    title: '删除集群',
    content: '确定删除？',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await k8sApi.deleteKubernetesCluster(orgSlug.value, id);
        uni.showToast({ title: '已删除', icon: 'success' });
        await loadK8s();
      } catch (e) {
        uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
      }
    },
  });
}

function syncConcurrency() {
  if (!form.value) return;
  const n = Number(buildConcurrencyStr.value);
  if (Number.isFinite(n) && n > 0) form.value.buildConcurrency = n;
}

function syncRetention() {
  if (!form.value) return;
  const n = Number(retentionStr.value);
  if (Number.isFinite(n) && n >= 1) form.value.artifactRetention = n;
}

async function save() {
  const f = form.value;
  if (!f || !orgSlug.value) return;
  if (!f.name.trim() || !f.slug.trim()) {
    uni.showToast({ title: '请填写组织名称与 URL 标识', icon: 'none' });
    return;
  }
  if (!isValidUrlSlug(f.slug.trim())) {
    uni.showToast({ title: URL_SLUG_VALIDATION_MESSAGE, icon: 'none' });
    return;
  }
  syncConcurrency();
  syncRetention();
  const slugBefore = orgSlug.value;
  saving.value = true;
  try {
    await settingsApi.updateOrg(slugBefore, {
      name: f.name.trim(),
      slug: f.slug.trim(),
      buildConcurrency: f.buildConcurrency,
      artifactRetention: f.artifactRetention,
    });
    await orgStore.fetchOrgs();
    const slugAfter = f.slug.trim();
    if (slugAfter !== slugBefore) {
      orgStore.setCurrentOrg(slugAfter);
      uni.redirectTo({
        url: `/package-org/pages/settings/org?orgSlug=${encodeURIComponent(slugAfter)}`,
      });
    }
    uni.showToast({ title: '已保存', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>
