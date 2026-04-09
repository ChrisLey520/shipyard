<template>
  <n-layout style="height: 100vh" has-sider>
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      :collapsed="collapsed"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <!-- Logo -->
      <div class="logo" :class="{ collapsed }">
        <span v-if="!collapsed" style="font-size: 18px; font-weight: 700; color: #18a058">
          ⚓ Shipyard
        </span>
        <span v-else style="font-size: 18px">⚓</span>
      </div>

      <!-- 组织切换 -->
      <n-select
        v-if="!collapsed && orgOptions.length > 0"
        v-model:value="currentOrgSlug"
        :options="orgOptions"
        size="small"
        style="margin: 8px 12px; width: calc(100% - 24px)"
        :menu-props="{ style: { maxWidth: '220px' } }"
        @update:value="switchOrg"
      >
        <template #action>
          <div style="padding: 0 2px 2px">
            <n-button
              size="small"
              quaternary
              block
              style="height: 32px; width: 100%"
              @click="openCreateOrg"
            >
              + 创建组织
            </n-button>
          </div>
        </template>
      </n-select>

      <n-menu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>

    <n-layout>
      <!-- 顶栏 -->
      <n-layout-header bordered style="height: 56px; display: flex; align-items: center; padding: 0 20px; gap: 12px">
        <n-button quaternary circle @click="collapsed = !collapsed">
          <template #icon>
            <n-icon><MenuOutlined /></n-icon>
          </template>
        </n-button>
        <div style="flex: 1" />
        <n-dropdown :options="userMenuOptions" @select="handleUserMenu">
          <n-button quaternary>
            <n-avatar
              v-if="userAvatarResolvedUrl && !userAvatarFailed"
              :key="userAvatarResolvedUrl"
              :src="userAvatarResolvedUrl"
              round
              size="small"
              object-fit="cover"
              :img-props="{ style: { objectFit: 'cover' } }"
              style="margin-right: 8px"
              :on-error="handleUserAvatarError"
            />
            <n-avatar v-else round size="small" style="margin-right: 8px">
              {{ (auth.user?.name ?? auth.user?.email ?? 'U').slice(0, 1).toUpperCase() }}
            </n-avatar>
            {{ auth.user?.name }}
          </n-button>
        </n-dropdown>
      </n-layout-header>

      <n-layout-content style="overflow-y: auto; height: calc(100vh - 56px)">
        <div class="app-shell">
          <div class="app-bg">
            <div class="app-bg-grid" />
            <div class="app-bg-blur-1" />
            <div class="app-bg-blur-2" />
          </div>
          <div style="position: relative; padding: 24px">
            <router-view />
          </div>
        </div>
      </n-layout-content>
    </n-layout>
  </n-layout>

  <n-modal v-model:show="showCreateOrg" title="创建组织" preset="card" style="width: 440px">
    <n-form :model="createOrgForm" label-placement="left" label-width="80">
      <n-form-item label="组织名称">
        <n-input v-model:value="createOrgForm.name" @input="autoSlugForCreateOrg" />
      </n-form-item>
      <n-form-item label="URL 标识">
        <n-input v-model:value="createOrgForm.slug" placeholder="只能包含小写字母、数字和连字符" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button :disabled="creatingOrg" @click="showCreateOrg = false">取消</n-button>
        <n-button type="primary" :loading="creatingOrg" @click="handleCreateOrg">创建</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NButton, NIcon, NAvatar, NDropdown, NSelect, NModal, NForm, NFormItem, NInput, NSpace,
  type MenuOption,
} from 'naive-ui';
import { useAuthStore } from '../../stores/auth';
import { useOrgStore } from '../../stores/org';
import { createOrg } from '../../pages/orgs/api';

// 临时图标组件（实际项目中使用 @vicons）
const MenuOutlined = { render: () => h('span', '☰') };

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const orgStore = useOrgStore();

const collapsed = ref(false);
const currentOrgSlug = ref((route.params['orgSlug'] as string | undefined) ?? orgStore.currentOrgSlug ?? '');

const showCreateOrg = ref(false);
const creatingOrg = ref(false);
const createOrgForm = ref({ name: '', slug: '' });

const userAvatarFailed = ref(false);
const userAvatarUrl = computed(() => auth.user?.avatarUrl ?? null);
const userAvatarBust = computed(() => (auth.user?.avatarUrl ? auth.user.avatarUrl : ''));
const userAvatarDisplayUrl = computed(() => {
  if (!userAvatarUrl.value) return null;
  const sep = userAvatarUrl.value.includes('?') ? '&' : '?';
  // 使用 avatarUrl 本身作为 bust 来源，避免每次渲染都变
  return `${userAvatarUrl.value}${sep}v=${encodeURIComponent(userAvatarBust.value)}`;
});
const userAvatarResolvedUrl = computed(() => {
  if (!userAvatarDisplayUrl.value) return null;
  return new URL(userAvatarDisplayUrl.value, window.location.origin).toString();
});

function handleUserAvatarError() {
  userAvatarFailed.value = true;
}

function openCreateOrg() {
  createOrgForm.value = { name: '', slug: '' };
  showCreateOrg.value = true;
}

function autoSlugForCreateOrg() {
  createOrgForm.value.slug = createOrgForm.value.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function handleCreateOrg() {
  if (!createOrgForm.value.name || !createOrgForm.value.slug) return;
  creatingOrg.value = true;
  try {
    await createOrg({ name: createOrgForm.value.name, slug: createOrgForm.value.slug });
    await orgStore.fetchOrgs();
    showCreateOrg.value = false;
    currentOrgSlug.value = createOrgForm.value.slug;
    orgStore.setCurrentOrg(createOrgForm.value.slug);
    void router.push(`/orgs/${createOrgForm.value.slug}`);
  } finally {
    creatingOrg.value = false;
  }
}

const orgOptions = computed(() =>
  orgStore.orgs.map((o) => ({ label: o.name, value: o.slug })),
);

const menuOptions = computed<MenuOption[]>(() => {
  const slug = currentOrgSlug.value;
  if (!slug) return [];
  return [
    { label: 'Dashboard', key: `/orgs/${slug}`, icon: () => h('span', '📊') },
    { label: '项目', key: `/orgs/${slug}/projects`, icon: () => h('span', '📦') },
    { label: '服务器', key: `/orgs/${slug}/servers`, icon: () => h('span', '🖥') },
    { label: '团队', key: `/orgs/${slug}/team`, icon: () => h('span', '👥') },
    { label: '审批中心', key: `/orgs/${slug}/approvals`, icon: () => h('span', '✅') },
    { label: '组织设置', key: `/orgs/${slug}/settings`, icon: () => h('span', '⚙️') },
  ];
});

const activeKey = computed(() => route.path);

const userMenuOptions = [
  { label: '个人设置', key: 'settings' },
  { label: '退出登录', key: 'logout' },
];

function handleMenuSelect(key: string) {
  void router.push(key);
}

function switchOrg(slug: string) {
  void router.push(`/orgs/${slug}`);
}

async function handleUserMenu(key: string) {
  if (key === 'logout') {
    await auth.logout();
    void router.push('/login');
  } else if (key === 'settings') {
    void router.push('/settings');
  }
}

onMounted(async () => {
  await orgStore.fetchOrgs();
  if (!auth.user) await auth.fetchMe();
  const slugFromRoute = route.params['orgSlug'] as string | undefined;
  if (slugFromRoute) {
    currentOrgSlug.value = slugFromRoute;
    orgStore.setCurrentOrg(slugFromRoute);
    return;
  }

  // 仅在组织选择页（/orgs）时，尽量自动进入一个组织，避免侧边栏为空
  // 其它不带 orgSlug 的页面（例如 /settings）刷新时不应被强制跳转到 dashboard
  if (route.path !== '/orgs') return;

  const remembered = orgStore.currentOrgSlug ?? null;
  if (remembered) {
    currentOrgSlug.value = remembered;
    void router.replace(`/orgs/${remembered}`);
    return;
  }
  if (orgStore.orgs.length === 1) {
    const only = orgStore.orgs[0]!;
    currentOrgSlug.value = only.slug;
    orgStore.setCurrentOrg(only.slug);
    void router.replace(`/orgs/${only.slug}`);
  }
});
</script>

<style scoped>
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--n-border-color);
}
</style>
