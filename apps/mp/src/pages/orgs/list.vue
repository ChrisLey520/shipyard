<template>
  <view class="p-3">
    <view class="flex justify-between items-center mb-3">
      <text class="text-lg font-semibold">组织</text>
      <view class="flex gap-2">
        <wd-button size="small" plain @click="goPersonal">我的</wd-button>
        <wd-button size="small" type="primary" @click="showCreate = true">新建</wd-button>
      </view>
    </view>
    <wd-loading v-if="loading" />
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
      <view v-if="!orgStore.orgs.length" class="text-gray-500 text-center py-8">暂无组织</view>
    </view>

    <wd-popup v-model="showCreate" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <wd-input v-model="form.name" label="名称" />
        <wd-input v-model="form.slug" label="Slug" />
        <wd-button block type="primary" class="mt-3" :loading="creating" @click="handleCreate">创建</wd-button>
        <wd-button block plain class="mt-2" @click="showCreate = false">取消</wd-button>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useAuthStore } from '@/stores/auth';
import { useOrgStore } from '@/stores/org';
import * as orgsApi from '@/api/orgs';
import { slugifyFromDisplayName } from '@shipyard/shared';
import { HttpError } from '@/api/http';
import { reLaunchToLoginWithRedirect } from '@/utils/redirectLogin';

const auth = useAuthStore();
const orgStore = useOrgStore();
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const form = ref({ name: '', slug: '' });

onShow(() => {
  if (!auth.isAuthenticated) {
    reLaunchToLoginWithRedirect();
  }
});

onMounted(async () => {
  await load();
});

async function load() {
  if (!auth.isAuthenticated) return;
  loading.value = true;
  try {
    await orgStore.fetchOrgs();
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : '加载失败';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function enterOrg(slug: string) {
  orgStore.setCurrentOrg(slug);
  uni.navigateTo({
    url: `/package-org/pages/dashboard/index?orgSlug=${encodeURIComponent(slug)}`,
  });
}

function goPersonal() {
  uni.navigateTo({ url: '/pages/settings/personal' });
}

watch(
  () => form.value.name,
  (n) => {
    form.value.slug = slugifyFromDisplayName(n);
  },
);

async function handleCreate() {
  if (!form.value.name.trim() || !form.value.slug.trim()) {
    uni.showToast({ title: '请填写名称与 Slug', icon: 'none' });
    return;
  }
  creating.value = true;
  try {
    await orgsApi.createOrg({ name: form.value.name.trim(), slug: form.value.slug.trim() });
    await orgStore.fetchOrgs();
    showCreate.value = false;
    form.value = { name: '', slug: '' };
    uni.showToast({ title: '已创建', icon: 'success' });
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : '创建失败';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    creating.value = false;
  }
}
</script>
