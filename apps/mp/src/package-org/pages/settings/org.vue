<template>
  <view class="p-3">
    <OrgNavGrid v-if="orgSlug" :org-slug="orgSlug" />
    <wd-loading v-if="loading" />
    <view v-else-if="form">
      <wd-input v-model="form.name" label="组织名称" />
      <wd-input v-model="form.slug" label="Slug" disabled />
      <wd-input v-model="buildConcurrencyStr" label="构建并发" type="number" @blur="syncConcurrency" />
      <wd-input v-model="retentionStr" label="产物保留(天)" type="number" @blur="syncRetention" />
      <wd-button block type="primary" class="mt-4" :loading="saving" @click="save">保存</wd-button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as settingsApi from '@/api/settings';
import type { OrgSettings } from '@/api/settings';
import { HttpError } from '@/api/http';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const loading = ref(false);
const saving = ref(false);
const form = ref<OrgSettings | null>(null);
const buildConcurrencyStr = ref('');
const retentionStr = ref('');

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

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
    } catch (e) {
      uni.showToast({ title: e instanceof HttpError ? e.message : '加载失败', icon: 'none' });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function syncConcurrency() {
  if (!form.value) return;
  const n = Number(buildConcurrencyStr.value);
  if (Number.isFinite(n) && n > 0) form.value.buildConcurrency = n;
}

function syncRetention() {
  if (!form.value) return;
  const n = Number(retentionStr.value);
  if (Number.isFinite(n) && n >= 0) form.value.artifactRetention = n;
}

async function save() {
  const f = form.value;
  if (!f || !orgSlug.value) return;
  syncConcurrency();
  syncRetention();
  saving.value = true;
  try {
    await settingsApi.updateOrg(orgSlug.value, {
      name: f.name.trim(),
      buildConcurrency: f.buildConcurrency,
      artifactRetention: f.artifactRetention,
    });
    uni.showToast({ title: '已保存', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof HttpError ? e.message : '失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>
