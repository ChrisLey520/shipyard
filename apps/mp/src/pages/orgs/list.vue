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
  <view class="p-3 mp-tab-page--with-bottom-bar mp-page-column-fill">
    <view class="flex justify-between items-center mb-3">
      <text class="text-lg font-semibold">{{ t('org.title') }}</text>
      <wd-button size="small" type="primary" @click="showCreate = true">{{ t('orgsList.newOrg') }}</wd-button>
    </view>

    <wd-loading v-if="loading" />

    <!-- 无组织：空状态 -->
    <view v-else-if="!orgStore.orgs.length" class="mp-page-column-fill__grow">
      <mp-page-empty
        variant="page"
        :title="t('orgsList.empty')"
        :description="t('orgsList.emptyHint')"
      >
        <template #footer>
          <wd-button type="primary" custom-class="orgs-empty-cta" @click="showCreate = true">
            {{ t('orgsList.emptyCta') }}
          </wd-button>
        </template>
      </mp-page-empty>
    </view>

    <!-- 单个组织：详情（并同步为当前组织） -->
    <view v-else-if="orgStore.orgs.length === 1 && onlyOrg" class="orgs-single">
      <text class="orgs-section-label">{{ t('orgsList.singleHeading') }}</text>
      <wd-cell-group border>
        <wd-cell :title="t('orgsList.name')" :value="onlyOrg.name" />
        <wd-cell :title="t('orgsList.slugLabel')" :value="onlyOrg.slug" />
        <wd-cell :title="t('org.settings')" is-link @click="goOrgSettings(onlyOrg.slug)" />
      </wd-cell-group>
      <wd-button block type="primary" custom-class="mt-4" @click="enterOrg(onlyOrg.slug)">
        {{ t('orgsList.enterHome') }}
      </wd-button>
    </view>

    <!-- 多个组织：列表 -->
    <view v-else>
      <wd-cell-group>
        <wd-cell
          v-for="o in orgStore.orgs"
          :key="o.id"
          :title="o.name"
          :label="o.slug"
          is-link
          @click="enterOrg(o.slug)"
        />
      </wd-cell-group>
    </view>

    <wd-popup v-model="showCreate" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <wd-input v-model="form.name" :label="t('orgsList.name')" />
        <wd-input v-model="form.slug" :label="t('orgsList.slugLabel')" />
        <wd-button block type="primary" class="mt-3" :loading="creating" @click="handleCreate">
          {{ t('orgsList.create') }}
        </wd-button>
        <wd-button block plain class="mt-2" @click="showCreate = false">{{ t('common.cancel') }}</wd-button>
      </view>
    </wd-popup>
  </view>
  <mp-main-tab-bar :tab-index="3" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useOrgStore } from '@/stores/org';
import * as orgsApi from '@/api/orgs';
import { slugifyFromDisplayName } from '@shipyard/shared';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import { reLaunchToLoginWithRedirect } from '@/utils/redirectLogin';
const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();
const { t } = useI18n();
const auth = useAuthStore();
const orgStore = useOrgStore();
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const form = ref({ name: '', slug: '' });

const onlyOrg = computed(() => (orgStore.orgs.length === 1 ? orgStore.orgs[0] : null));

onShow(() => {
  if (!auth.isAuthenticated) {
    reLaunchToLoginWithRedirect();
    return;
  }
  void load();
});

async function load() {
  if (!auth.isAuthenticated) return;
  loading.value = true;
  try {
    await orgStore.fetchOrgs();
    if (orgStore.orgs.length === 1) {
      orgStore.setCurrentOrg(orgStore.orgs[0].slug);
    }
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

function enterOrg(slug: string) {
  orgStore.setCurrentOrg(slug);
  uni.switchTab({ url: '/pages/workspace/dashboard' });
}

function goOrgSettings(slug: string) {
  orgStore.setCurrentOrg(slug);
  const o = encodeURIComponent(slug);
  uni.navigateTo({ url: `/package-org/pages/settings/org?orgSlug=${o}` });
}

watch(
  () => form.value.name,
  (n) => {
    form.value.slug = slugifyFromDisplayName(n);
  },
);

async function handleCreate() {
  if (!form.value.name.trim() || !form.value.slug.trim()) {
    uni.showToast({ title: t('orgsList.fillNameSlug'), icon: 'none' });
    return;
  }
  creating.value = true;
  try {
    await orgsApi.createOrg({ name: form.value.name.trim(), slug: form.value.slug.trim() });
    await orgStore.fetchOrgs();
    showCreate.value = false;
    form.value = { name: '', slug: '' };
    if (orgStore.orgs.length === 1) {
      orgStore.setCurrentOrg(orgStore.orgs[0].slug);
    }
    uni.showToast({ title: t('orgsList.created'), icon: 'success' });
  } catch {
    // 全局 request 已提示
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
:deep(.orgs-empty-cta) {
  min-width: 280rpx;
}

.orgs-single {
  padding-top: 8rpx;
}

.orgs-section-label {
  display: block;
  font-size: 24rpx;
  color: #64748b;
  margin-bottom: 16rpx;
}
</style>
