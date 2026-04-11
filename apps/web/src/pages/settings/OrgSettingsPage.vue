<template>
  <div style="max-width: 640px">
    <n-page-header title="组织设置" />

    <n-card title="Kubernetes 集群（环境 releaseConfig 引用）" style="margin-top: 16px">
      <n-space vertical>
        <n-button size="small" type="primary" @click="openK8sModal">登记集群</n-button>
        <n-list bordered>
          <n-list-item v-for="c in k8sClusters" :key="c.id">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%">
              <span>{{ c.name }}</span>
              <n-button size="tiny" type="error" @click="removeK8s(c.id)">删除</n-button>
            </div>
          </n-list-item>
        </n-list>
        <n-empty v-if="k8sClusters.length === 0" description="暂无集群" />
      </n-space>
    </n-card>

    <n-card title="组织级特性开关" style="margin-top: 16px">
      <org-feature-flags-section :org-slug="orgSlug" />
    </n-card>

    <n-modal
      v-model:show="showK8s"
      title="登记 Kubernetes 集群"
      preset="card"
      style="width: 520px"
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

    <n-card title="基本信息" style="margin-top: 16px">
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
  NModal,
  NSpace,
  NList,
  NListItem,
  NEmpty,
  useMessage,
} from 'naive-ui';
import {
  createKubernetesCluster,
  deleteKubernetesCluster,
  listKubernetesClusters,
  type KubernetesClusterRow,
} from '@/api/kubernetes-clusters';
import OrgFeatureFlagsSection from './components/OrgFeatureFlagsSection.vue';
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

async function loadK8s() {
  try {
    k8sClusters.value = await listKubernetesClusters(orgSlug.value);
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
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    message.error(err?.response?.data?.message ?? '保存失败');
  } finally {
    k8sSaving.value = false;
  }
}

async function removeK8s(id: string) {
  try {
    await deleteKubernetesCluster(orgSlug.value, id);
    message.success('已删除');
    await loadK8s();
  } catch {
    message.error('删除失败');
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
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '保存失败');
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
</script>
