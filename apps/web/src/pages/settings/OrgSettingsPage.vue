<template>
  <div class="mx-auto w-full max-w-[min(100%,1200px)] min-w-0 page-header-stack-sm">
    <n-page-header title="组织设置" />

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <n-card title="Kubernetes 集群（环境 releaseConfig 引用）">
        <template #header-extra>
          <n-button size="small" type="primary" @click="openK8sModal">登记集群</n-button>
        </template>
        <n-space vertical>
          <n-list v-if="k8sClusters.length > 0" bordered>
            <n-list-item v-for="c in k8sClusters" :key="c.id">
              <div class="flex w-full flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:justify-between">
                <span class="min-w-0 break-words">{{ c.name }}</span>
                <div class="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <n-button
                        quaternary
                        circle
                        size="tiny"
                        aria-label="查看集群 ID"
                        @click="openClusterIdModal(c)"
                      >
                        <template #icon>
                          <n-icon :component="KeyOutline" />
                        </template>
                      </n-button>
                    </template>
                    查看集群 ID
                  </n-tooltip>
                  <n-button size="tiny" type="error" @click="confirmRemoveK8s(c)">删除</n-button>
                </div>
              </div>
            </n-list-item>
          </n-list>
          <n-empty v-else description="暂无集群" />
        </n-space>
      </n-card>

      <n-card title="基本信息">
        <n-form :model="form" label-placement="left" label-width="120">
          <n-form-item label="组织名称">
            <n-input v-model:value="form.name" />
          </n-form-item>
          <n-form-item label="URL 标识">
            <n-input v-model:value="form.slug" placeholder="只能包含小写字母、数字和连字符" />
          </n-form-item>
          <n-form-item label="并行构建数">
            <n-input-number v-model:value="form.buildConcurrency" :min="1" :max="10" />
          </n-form-item>
          <n-form-item label="产物保留数量">
            <n-input-number v-model:value="form.artifactRetention" :min="1" :max="100" />
          </n-form-item>
          <n-form-item>
            <n-button type="primary" :loading="saving" @click="save">保存</n-button>
          </n-form-item>
        </n-form>
      </n-card>

      <n-card class="lg:col-span-2" title="组织级特性开关">
        <org-feature-flags-section :org-slug="orgSlug" />
      </n-card>
    </div>

    <n-modal
      v-model:show="showK8s"
      title="登记 Kubernetes 集群"
      preset="card"
      style="width: min(520px, calc(100vw - 32px))"
      :mask-closable="false"
    >
      <n-form label-placement="top">
        <n-form-item label="名称（组织内唯一）">
          <n-input v-model:value="k8sForm.name" placeholder="如 prod-eks" />
        </n-form-item>
        <n-form-item label="Kubeconfig 全文">
          <n-input v-model:value="k8sForm.kubeconfig" type="textarea" :rows="10" placeholder="粘贴 kubeconfig YAML" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showK8s = false">取消</n-button>
          <n-button type="primary" :loading="k8sSaving" @click="saveK8s">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showClusterId"
      title="集群 ID"
      preset="card"
      style="width: min(520px, calc(100vw - 32px))"
    >
      <n-space vertical size="small">
        <div class="text-sm text-[var(--n-text-color-3)]">用于填写环境的 releaseConfig.kubernetes.clusterId</div>
        <n-input :value="selectedClusterId" readonly />
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showClusterId = false">关闭</n-button>
          <n-button type="primary" :disabled="!selectedClusterId" @click="copyClusterId">复制</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NPageHeader,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NTooltip,
  NIcon,
  NModal,
  NSpace,
  NList,
  NListItem,
  NEmpty,
  useMessage,
} from 'naive-ui';
import { KeyOutline } from '@vicons/ionicons5';
import {
  createKubernetesCluster,
  deleteKubernetesCluster,
  listKubernetesClusters,
  type KubernetesClusterRow,
} from '@/api/kubernetes-clusters';
import OrgFeatureFlagsSection from './components/OrgFeatureFlagsSection.vue';
import { openDestructiveNameConfirm } from '@/ui/destructiveNameConfirm';
import { useOrgStore } from '../../stores/org';
import { useOrgSettings } from '@/composables/orgs/useOrgSettings';
import { URL_SLUG_VALIDATION_MESSAGE, isValidUrlSlug } from '@shipyard/shared';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgStore = useOrgStore();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const { org, saveOrg, saving } = useOrgSettings(orgSlug);
const form = ref({ name: '', slug: '', buildConcurrency: 2, artifactRetention: 10 });

const k8sClusters = ref<KubernetesClusterRow[]>([]);
const showK8s = ref(false);
const k8sSaving = ref(false);
const k8sForm = ref({ name: '', kubeconfig: '' });
const showClusterId = ref(false);
const selectedClusterId = ref('');

async function loadK8s() {
  try {
    k8sClusters.value = await listKubernetesClusters(orgSlug.value, { shipyard: { silent: true } });
  } catch {
    k8sClusters.value = [];
  }
}

function openK8sModal() {
  k8sForm.value = { name: '', kubeconfig: '' };
  showK8s.value = true;
}

async function saveK8s() {
  if (!k8sForm.value.name.trim() || !k8sForm.value.kubeconfig.trim()) {
    message.warning('请填写名称与 kubeconfig');
    return;
  }
  k8sSaving.value = true;
  try {
    await createKubernetesCluster(orgSlug.value, {
      name: k8sForm.value.name.trim(),
      kubeconfig: k8sForm.value.kubeconfig.trim(),
    });
    message.success('已保存');
    showK8s.value = false;
    await loadK8s();
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  } finally {
    k8sSaving.value = false;
  }
}

function confirmRemoveK8s(c: KubernetesClusterRow) {
  openDestructiveNameConfirm({
    title: '删除 Kubernetes 集群登记？',
    description: `将移除「${c.name}」的 kubeconfig 登记；引用该集群的环境 release 配置可能失效。`,
    expected: c.name,
    expectedLabel: '集群名称',
    positiveText: '删除',
    onConfirm: async () => {
      await deleteKubernetesCluster(orgSlug.value, c.id);
      message.success('已删除');
      await loadK8s();
    },
  });
}

function openClusterIdModal(c: KubernetesClusterRow) {
  selectedClusterId.value = c.id;
  showClusterId.value = true;
}

async function copyClusterId() {
  await copyText(selectedClusterId.value);
}

async function copyText(text: string) {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
      return;
    }
    throw new Error('Clipboard API not available');
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.left = '-1000px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        message.success('已复制');
      } else {
        message.error('复制失败');
      }
    } catch {
      message.error('复制失败');
    }
  }
}

async function save() {
  if (!form.value.name || !form.value.slug) {
    message.error('请填写组织名称与 URL 标识');
    return;
  }
  if (!isValidUrlSlug(form.value.slug)) {
    message.error(URL_SLUG_VALIDATION_MESSAGE);
    return;
  }
  const slugBefore = orgSlug.value;
  try {
    await saveOrg(form.value);
    await orgStore.fetchOrgs();
    if (form.value.slug !== slugBefore) {
      orgStore.setCurrentOrg(form.value.slug);
      await router.replace(`/orgs/${form.value.slug}/settings`);
    }
    message.success('保存成功');
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  }
}

watch(
  () => org.value,
  (o) => {
    if (!o) return;
    form.value = {
      name: o.name,
      slug: o.slug,
      buildConcurrency: o.buildConcurrency,
      artifactRetention: o.artifactRetention,
    };
  },
  { immediate: true },
);

watch(
  orgSlug,
  () => void loadK8s(),
  { immediate: true },
);

watch(showClusterId, (v) => {
  if (v) return;
  selectedClusterId.value = '';
});
</script>
