<template>
  <div style="max-width: 640px">
    <n-page-header title="组织设置" />

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
import { NPageHeader, NCard, NForm, NFormItem, NInput, NInputNumber, NButton, useMessage } from 'naive-ui';
import { useOrgStore } from '../../stores/org';
import { getOrg, updateOrg } from './api';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const orgStore = useOrgStore();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const saving = ref(false);
const form = ref({ name: '', slug: '', buildConcurrency: 2, artifactRetention: 10 });

const slugPattern = /^[a-z0-9-]+$/;

async function save() {
  if (!form.value.name || !form.value.slug) {
    message.error('请填写组织名称与 URL 标识');
    return;
  }
  if (!slugPattern.test(form.value.slug) || form.value.slug.length > 64) {
    message.error('URL 标识仅允许小写字母、数字和连字符，长度不超过 64');
    return;
  }
  saving.value = true;
  const slugBefore = orgSlug.value;
  try {
    await updateOrg(slugBefore, form.value);
    await orgStore.fetchOrgs();
    if (form.value.slug !== slugBefore) {
      orgStore.setCurrentOrg(form.value.slug);
      await router.replace(`/orgs/${form.value.slug}/settings`);
    }
    message.success('保存成功');
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    message.error(e?.response?.data?.message ?? '保存失败');
  } finally {
    saving.value = false;
  }
}

watch(
  orgSlug,
  async (slug) => {
    const org = await getOrg(slug);
    form.value = {
      name: org.name,
      slug: org.slug,
      buildConcurrency: org.buildConcurrency,
      artifactRetention: org.artifactRetention,
    };
  },
  { immediate: true },
);
</script>
