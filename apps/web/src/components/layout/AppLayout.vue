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
        v-if="!collapsed && currentOrg"
        v-model:value="currentOrgSlug"
        :options="orgOptions"
        size="small"
        style="margin: 8px 12px"
        @update:value="switchOrg"
      />

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
            <n-avatar round size="small" style="margin-right: 8px">
              {{ auth.user?.name?.[0]?.toUpperCase() }}
            </n-avatar>
            {{ auth.user?.name }}
          </n-button>
        </n-dropdown>
      </n-layout-header>

      <n-layout-content style="padding: 24px; overflow-y: auto; height: calc(100vh - 56px)">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NButton, NIcon, NAvatar, NDropdown, NSelect,
  type MenuOption,
} from 'naive-ui';
import { useAuthStore } from '../../stores/auth';
import { useOrgStore } from '../../stores/org';

// 临时图标组件（实际项目中使用 @vicons）
const MenuOutlined = { render: () => h('span', '☰') };

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const orgStore = useOrgStore();

const collapsed = ref(false);
const currentOrgSlug = ref(route.params['orgSlug'] as string ?? '');
const currentOrg = computed(() => orgStore.currentOrg);

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
  const slug = route.params['orgSlug'] as string;
  if (slug) {
    currentOrgSlug.value = slug;
    orgStore.setCurrentOrg(slug);
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
