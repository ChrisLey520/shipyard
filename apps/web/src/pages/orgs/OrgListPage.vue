<template>
  <div class="min-w-0 page-header-stack-sm">
    <n-page-header :title="t('org.orgsTitle')">
      <template #extra>
        <n-button type="primary" @click="showCreate = true">{{ t('org.createOrgAction') }}</n-button>
      </template>
    </n-page-header>

    <!-- 组织卡片以名称为准：中屏起两列、大屏三列 -->
    <n-grid responsive="screen" cols="1 m:2 xl:3" :x-gap="16" :y-gap="16" class="mt-4">
      <n-grid-item v-for="org in orgStore.orgs" :key="org.id">
        <n-card hoverable @click="router.push(`/orgs/${org.slug}`)">
          <div class="text-lg font-600 leading-snug break-words">{{ org.name }}</div>
          <n-text depth="3" class="mt-0.5 block text-[13px] break-all">{{ org.slug }}</n-text>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-modal
      v-model:show="showCreate"
      :title="t('org.createOrgTitle')"
      preset="card"
      style="width: min(440px, calc(100vw - 32px))"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-form :model="form" label-placement="left" label-width="80">
        <n-form-item :label="t('org.orgName')">
          <n-input v-model:value="form.name" @input="autoSlug" />
        </n-form-item>
        <n-form-item :label="t('org.orgSlug')">
          <n-input v-model:value="form.slug" :placeholder="t('org.orgSlugPlaceholder')" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreate = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="creating" @click="handleCreate">{{ t('org.create') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  NPageHeader, NGrid, NGridItem, NCard, NText, NButton,
  NModal, NForm, NFormItem, NInput, NSpace, useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useOrgStore } from '../../stores/org';
import { useOrgCreateAction } from '@/composables/orgs/useOrgCreateAction';
import { slugifyFromDisplayName } from '@shipyard/shared';

const router = useRouter();
const orgStore = useOrgStore();
const { createOrg } = useOrgCreateAction();
const message = useMessage();
const { t } = useI18n();
const showCreate = ref(false);
const creating = ref(false);
const form = ref({ name: '', slug: '' });

function autoSlug() {
  form.value.slug = slugifyFromDisplayName(form.value.name);
}

async function handleCreate() {
  if (!form.value.name || !form.value.slug) {
    message.warning(t('org.fillAllFields'));
    return;
  }
  creating.value = true;
  try {
    await createOrg(form.value);
    await orgStore.fetchOrgs();
    showCreate.value = false;
    message.success(t('org.created'));
    void router.push(`/orgs/${form.value.slug}`);
  } finally {
    creating.value = false;
  }
}

onMounted(() => orgStore.fetchOrgs());
</script>
