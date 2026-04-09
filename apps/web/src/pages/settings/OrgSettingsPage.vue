<template>
  <div style="max-width: 640px">
    <n-page-header title="组织设置" />

    <n-card title="基本信息" style="margin-top: 16px">
      <n-form :model="form" label-placement="left" label-width="120">
        <n-form-item label="组织名称">
          <n-input v-model:value="form.name" />
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
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { NPageHeader, NCard, NForm, NFormItem, NInput, NInputNumber, NButton, useMessage } from 'naive-ui';
import { http } from '../../api/client';
import { useOrgStore } from '../../stores/org';

const route = useRoute();
const message = useMessage();
const orgStore = useOrgStore();
const orgSlug = route.params['orgSlug'] as string;
const saving = ref(false);
const form = ref({ name: '', buildConcurrency: 2, artifactRetention: 10 });

async function save() {
  saving.value = true;
  try {
    await http.patch(`/orgs/${orgSlug}`, form.value);
    await orgStore.fetchOrgs();
    message.success('保存成功');
  } catch {
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const org = await http.get(`/orgs/${orgSlug}`).then((r) => r.data);
  form.value = {
    name: org.name,
    buildConcurrency: org.buildConcurrency,
    artifactRetention: org.artifactRetention,
  };
});
</script>
