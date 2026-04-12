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
    <wd-loading v-if="loading" />
    <view v-else-if="form">
      <wd-cell-group title="Kubernetes 集群" border>
        <view class="flex justify-end pb-2">
          <wd-button size="small" type="primary" @click="openK8s">登记集群</wd-button>
        </view>
        <view
          v-for="c in k8sClusters"
          :key="c.id"
          class="flex justify-between items-center py-2 border-b border-gray-100"
        >
          <text>{{ c.name }}</text>
          <wd-button size="small" plain type="error" @click="confirmRemoveK8s(c)">删除</wd-button>
        </view>
        <mp-page-empty v-if="!k8sClusters.length" variant="embed" dense title="暂无集群" />
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
    <typed-destructive-confirm-host />
  </view>
  <mp-main-tab-bar :tab-index="3" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { URL_SLUG_VALIDATION_MESSAGE, isValidUrlSlug } from '@shipyard/shared';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import { useOrgStore } from '@/stores/org';
import * as settingsApi from '@/package-org/api/settings';
import type { OrgSettings } from '@/package-org/api/settings';
import * as k8sApi from '@/package-org/api/kubernetes-clusters';
import type { KubernetesClusterRow } from '@/package-org/api/kubernetes-clusters';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import OrgFeatureFlagsBlock from '../../components/OrgFeatureFlagsBlock.vue';
import TypedDestructiveConfirmHost from '@/components/TypedDestructiveConfirmHost.vue';
import { openTypedDestructiveMp } from '@/composables/typedDestructiveConfirmMp';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

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
    k8sClusters.value = await k8sApi.listKubernetesClusters(orgSlug.value, { silent: true });
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
    } catch {
      // 全局 request 已提示
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
  } catch {
    // 全局 request 已提示
  } finally {
    k8sSaving.value = false;
  }
}

function confirmRemoveK8s(c: KubernetesClusterRow) {
  openTypedDestructiveMp({
    title: '删除 Kubernetes 集群登记？',
    description: `将移除「${c.name}」的 kubeconfig 登记；引用该集群的环境 release 配置可能失效。`,
    expected: c.name,
    expectedLabel: '集群名称',
    positiveText: '删除',
    onConfirm: async () => {
      await k8sApi.deleteKubernetesCluster(orgSlug.value, c.id);
      uni.showToast({ title: '已删除', icon: 'success' });
      await loadK8s();
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
  } catch {
    // 全局 request 已提示
  } finally {
    saving.value = false;
  }
}
</script>
