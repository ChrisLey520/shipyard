<template>
  <n-layout class="h-screen" has-sider>
    <n-layout-sider
      id="shipyard-app-sider"
      role="navigation"
      :aria-label="t('nav.mainNavLabel')"
      bordered
      collapse-mode="width"
      :collapsed-width="isCompactLayout ? 0 : 64"
      :width="siderWidth"
      :collapsed="collapsed"
      :position="isCompactLayout ? 'absolute' : 'static'"
      :show-collapsed-content="!isCompactLayout"
      :content-style="siderContentStyle"
      class="app-layout-sider"
      :class="{ 'app-layout-sider--overlay': isCompactLayout }"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <!-- Logo -->
      <div class="logo" :class="{ collapsed }">
        <span v-if="!collapsed" class="logo-title text-[18px] font-700 text-[var(--n-primary-color)]">
          <n-icon class="logo-mark" :component="BoatOutline" />
          Shipyard
        </span>
        <n-icon v-else class="logo-mark-collapsed" :component="BoatOutline" />
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
              type="default"
              size="small"
              block
              style="height: 32px; width: 100%"
              @click="openCreateOrg"
            >
              {{ t('org.createOrgAction') }}
            </n-button>
          </div>
        </template>
      </n-select>

      <!-- 移动端抽屉内始终展开文案菜单；桌面端才使用折叠为图标栏 -->
      <n-menu
        :collapsed="menuCollapsedRail"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>

    <n-layout class="app-layout-main">
      <div
        v-if="isCompactLayout && !collapsed"
        class="app-layout-backdrop"
        aria-hidden="true"
        @click="collapsed = true"
      />
      <!-- 顶栏 -->
      <n-layout-header bordered class="app-layout-header h-14 flex items-center gap-2 sm:gap-3 px-3 sm:px-5">
        <n-button
          quaternary
          circle
          :aria-label="t('nav.toggleNav')"
          :aria-expanded="!collapsed"
          aria-controls="shipyard-app-sider"
          @click="collapsed = !collapsed"
        >
          <template #icon>
            <n-icon :component="MenuOutline" />
          </template>
        </n-button>
        <div class="flex-1" />
        <n-dropdown :options="themeMenuOptions" @select="handleThemeMenu">
          <n-button quaternary class="max-sm:px-2 shrink-0">
            <span class="truncate max-sm:max-w-[5.5rem] sm:max-w-none">{{ currentThemeLabel }}</span>
            <span class="ml-2 muted max-md:hidden shrink-0">
              {{ themeModeLabel }}
            </span>
          </n-button>
        </n-dropdown>
        <n-dropdown :options="userMenuOptions" @select="handleUserMenu">
          <n-button quaternary class="max-sm:px-2">
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
            <span class="max-sm:hidden">{{ auth.user?.name }}</span>
          </n-button>
        </n-dropdown>
      </n-layout-header>

      <n-layout-content
        class="app-layout-content min-w-0"
        style="overflow-y: auto; height: calc(100vh - 56px)"
      >
        <div class="app-shell">
          <div class="app-bg">
            <div class="app-bg-grid" />
            <div class="app-bg-blur-1" />
            <div class="app-bg-blur-2" />
          </div>
          <div class="app-layout-body">
            <div
              v-if="orgSlugParam && (orgGateLoading || orgGateError)"
              class="org-gate-center"
            >
              <n-spin v-if="orgGateLoading" size="large" />
              <n-result
                v-else-if="orgGateError === 'not_found'"
                status="warning"
                :title="t('orgGate.notFound.title')"
                :description="t('orgGate.notFound.description')"
              >
                <template #footer>
                  <n-button type="primary" @click="goOrgList">{{ t('common.backToOrgList') }}</n-button>
                </template>
              </n-result>
              <n-result
                v-else-if="orgGateError === 'no_member'"
                status="error"
                :title="t('orgGate.noMember.title')"
                :description="t('orgGate.noMember.description')"
              >
                <template #footer>
                  <n-button type="primary" @click="goOrgList">{{ t('common.backToOrgList') }}</n-button>
                </template>
              </n-result>
              <n-result
                v-else-if="orgGateError === 'no_permission'"
                status="error"
                :title="t('orgGate.noPermission.title')"
                :description="t('orgGate.noPermission.description')"
              >
                <template #footer>
                  <n-button type="primary" @click="goOrgList">{{ t('common.backToOrgList') }}</n-button>
                </template>
              </n-result>
              <n-result
                v-else-if="orgGateError === 'network'"
                status="error"
                :title="t('orgGate.network.title')"
                :description="t('orgGate.network.description')"
              >
                <template #footer>
                  <n-space>
                    <n-button @click="goOrgList">{{ t('common.backToOrgList') }}</n-button>
                    <n-button type="primary" :loading="orgGateLoading" @click="retryOrgGate">
                      {{ t('common.retry') }}
                    </n-button>
                  </n-space>
                </template>
              </n-result>
            </div>
            <router-view v-else />
          </div>
        </div>
      </n-layout-content>
    </n-layout>
  </n-layout>

  <n-modal
    v-model:show="showCreateOrg"
    :title="t('org.createOrgTitle')"
    preset="card"
    style="width: min(440px, calc(100vw - 32px))"
    :mask-closable="false"
    :close-on-esc="false"
  >
    <n-form :model="createOrgForm" label-placement="left" label-width="80">
      <n-form-item :label="t('org.orgName')">
        <n-input v-model:value="createOrgForm.name" @input="autoSlugForCreateOrg" />
      </n-form-item>
      <n-form-item :label="t('org.orgSlug')">
        <n-input v-model:value="createOrgForm.slug" :placeholder="t('org.orgSlugPlaceholder')" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button :disabled="creatingOrg" @click="showCreateOrg = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="creatingOrg" @click="handleCreateOrg">
          {{ t('org.create') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, onBeforeUnmount, watch, type Component, type CSSProperties } from 'vue';
import { useMediaQuery, useEventListener } from '@vueuse/core';
import NIconRenderer from './NIconRenderer.vue';
import { useRouter, useRoute } from 'vue-router';
import {
  NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NButton, NIcon, NAvatar, NDropdown, NSelect, NModal, NForm, NFormItem, NInput, NSpace,
  NSpin, NResult,
  type MenuOption,
  type DropdownOption,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/auth';
import { useOrgStore } from '../../stores/org';
import { useThemeStore } from '../../stores/theme';
import { THEME_OPTIONS, type ColorMode, type ThemeId } from '../../theme/themes';
import { createOrg, getOrgBySlug } from '@/api/orgs';
import { slugifyFromDisplayName } from '@shipyard/shared';
import {
  BoatOutline,
  MenuOutline,
  StatsChartOutline,
  CubeOutline,
  KeyOutline,
  DesktopOutline,
  PeopleOutline,
  CheckmarkDoneOutline,
  SettingsOutline,
} from '@vicons/ionicons5';

function menuIcon(icon: Component) {
  return () => h(NIconRenderer, { icon });
}

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const orgStore = useOrgStore();
const themeStore = useThemeStore();
const { t } = useI18n();

const collapsed = ref(false);
/** 窄屏：侧栏改为叠层抽屉，主区域全宽 */
const isCompactLayout = useMediaQuery('(max-width: 900px)');
const currentOrgSlug = ref(orgStore.currentOrgSlug ?? '');

/** 移动端抽屉宽度略大于桌面侧栏，便于拇指操作且不顶满屏 */
const siderWidth = computed(() => (isCompactLayout.value ? 'min(300px, calc(100vw - 12px))' : 220));

const siderContentStyle = computed<CSSProperties | undefined>(() =>
  isCompactLayout.value
    ? {
        minHeight: '100dvh',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
      }
    : undefined,
);

/** 桌面：与侧栏折叠同步为图标栏；移动：抽屉内始终展开文字菜单 */
const menuCollapsedRail = computed(() => (isCompactLayout.value ? false : collapsed.value));

watch(isCompactLayout, (narrow) => {
  if (narrow) collapsed.value = true;
});

/** 移动端抽屉打开时锁定背景滚动，避免误滑主内容 */
watch(
  () => ({ compact: isCompactLayout.value, drawerOpen: !collapsed.value }),
  ({ compact, drawerOpen }) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = compact && drawerOpen ? 'hidden' : '';
  },
  { flush: 'sync' },
);

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = '';
});

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return;
  if (!isCompactLayout.value || collapsed.value) return;
  collapsed.value = true;
});

watch(
  () => route.fullPath,
  () => {
    if (isCompactLayout.value) collapsed.value = true;
  },
);

const orgSlugParam = computed(() => route.params['orgSlug'] as string | undefined);
const orgGateLoading = ref(false);
const orgGateError = ref<null | 'not_found' | 'no_member' | 'no_permission' | 'network'>(null);
let orgGateSeq = 0;

async function runOrgGate(slug: string) {
  const seq = ++orgGateSeq;
  orgGateLoading.value = true;
  orgGateError.value = null;
  try {
    await getOrgBySlug(slug);
    if (seq !== orgGateSeq) return;
    currentOrgSlug.value = slug;
    orgStore.setCurrentOrg(slug);
  } catch (err) {
    if (seq !== orgGateSeq) return;
    const ax = err as { response?: { status?: number; data?: { message?: string; code?: string } } };
    const code = String(ax.response?.data?.code ?? '');
    const msg = String(ax.response?.data?.message ?? '');
    const status = ax.response?.status;
    currentOrgSlug.value = orgStore.currentOrgSlug ?? '';
    if (code === 'ORG_NOT_FOUND' || status === 404 || (status === 403 && msg.includes('组织不存在'))) {
      orgGateError.value = 'not_found';
    } else if (code === 'ORG_NOT_MEMBER' || (status === 403 && msg.includes('你不是该组织成员'))) {
      orgGateError.value = 'no_member';
    } else if (code === 'ORG_PERMISSION_DENIED' || (status === 403 && msg.includes('权限不足'))) {
      orgGateError.value = 'no_permission';
    } else {
      orgGateError.value = 'network';
    }
  } finally {
    if (seq === orgGateSeq) orgGateLoading.value = false;
  }
}

watch(
  orgSlugParam,
  (slug) => {
    if (!slug) {
      orgGateLoading.value = false;
      orgGateError.value = null;
      return;
    }
    void runOrgGate(slug);
  },
  { immediate: true },
);

function goOrgList() {
  orgGateError.value = null;
  void router.push('/orgs');
}

function retryOrgGate() {
  const slug = orgSlugParam.value;
  if (slug) void runOrgGate(slug);
}

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
  createOrgForm.value.slug = slugifyFromDisplayName(createOrgForm.value.name);
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

/** 侧栏组织菜单所用的 slug：在组织内路由用路径参数；在个人设置等全局页用当前选中的组织（与账号全局设置并存） */
const menuOrgSlug = computed(() => {
  const param = orgSlugParam.value;
  if (param) return param;
  if (route.path === '/settings') {
    return (currentOrgSlug.value || orgStore.currentOrgSlug || '').trim();
  }
  return '';
});

const menuOptions = computed<MenuOption[]>(() => {
  const slug = menuOrgSlug.value;
  if (!slug) return [];
  // 仅在「当前 URL 属于某组织」时，组织门禁未通过则不展示菜单；个人设置页用记忆组织，不受另一 URL 门禁影响
  if (orgSlugParam.value && (orgGateLoading.value || orgGateError.value)) return [];
  return [
    { label: t('nav.dashboard'), key: `/orgs/${slug}`, icon: menuIcon(StatsChartOutline) },
    { label: t('nav.projects'), key: `/orgs/${slug}/projects`, icon: menuIcon(CubeOutline) },
    { label: t('nav.gitAccounts'), key: `/orgs/${slug}/git-accounts`, icon: menuIcon(KeyOutline) },
    { label: t('nav.servers'), key: `/orgs/${slug}/servers`, icon: menuIcon(DesktopOutline) },
    { label: t('nav.team'), key: `/orgs/${slug}/team`, icon: menuIcon(PeopleOutline) },
    { label: t('nav.approvals'), key: `/orgs/${slug}/approvals`, icon: menuIcon(CheckmarkDoneOutline) },
    { label: t('nav.orgSettings'), key: `/orgs/${slug}/settings`, icon: menuIcon(SettingsOutline) },
  ];
});

const activeKey = computed(() => route.path);

const userMenuOptions: DropdownOption[] = [
  { label: t('nav.orgs'), key: 'orgs' },
  { type: 'divider', key: 'd-orgs' },
  { label: t('settings.personalTitle'), key: 'settings' },
  { type: 'divider', key: 'd-settings' },
  { label: t('auth.logout'), key: 'logout' },
];

const currentThemeLabel = computed(() => {
  const opt = THEME_OPTIONS.find((t) => t.id === themeStore.themeId);
  return opt?.label ?? t('theme.theme');
});

const themeModeLabel = computed(() => {
  const mode = themeStore.colorMode;
  if (mode === 'auto') return themeStore.isDark ? t('theme.followSystemDark') : t('theme.followSystemLight');
  return mode === 'dark' ? t('theme.dark') : t('theme.light');
});

const themeMenuOptions = computed<DropdownOption[]>(() => {
  const themeItems: DropdownOption[] = THEME_OPTIONS.map((t) => ({
    label: t.label,
    key: `theme:${t.id}`,
  }));
  return [
    ...themeItems,
    { type: 'divider', key: 'd-theme' },
    { label: t('theme.modeAuto'), key: 'mode:auto' },
    { label: t('theme.modeLight'), key: 'mode:light' },
    { label: t('theme.modeDark'), key: 'mode:dark' },
  ];
});

function handleMenuSelect(key: string) {
  if (isCompactLayout.value) collapsed.value = true;
  void router.push(key);
}

function switchOrg(slug: string) {
  if (isCompactLayout.value) collapsed.value = true;
  void router.push(`/orgs/${slug}`);
}

function handleThemeMenu(key: string) {
  if (key.startsWith('theme:')) {
    const id = key.slice('theme:'.length) as ThemeId;
    themeStore.setThemeId(id);
    return;
  }
  if (key.startsWith('mode:')) {
    const mode = key.slice('mode:'.length) as ColorMode;
    themeStore.setColorMode(mode);
  }
}

async function handleUserMenu(key: string) {
  if (key === 'logout') {
    await auth.logout();
    void router.push('/login');
  } else if (key === 'settings') {
    void router.push('/settings');
  } else if (key === 'orgs') {
    goOrgList();
  }
}

onMounted(async () => {
  await orgStore.fetchOrgs();
  if (!auth.user) await auth.fetchMe();

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

.logo-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.logo-mark {
  font-size: 22px;
}

.logo-mark-collapsed {
  font-size: 22px;
  margin: 0 auto;
}

/* 组织校验失败/加载时主区域垂直水平居中 */
.org-gate-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 56px - 48px);
  width: 100%;
  box-sizing: border-box;
}

.org-gate-center :deep(.n-result) {
  max-width: 560px;
}

.app-layout-main {
  position: relative;
  min-width: 0;
}

.app-layout-header {
  position: relative;
  z-index: 1002;
  min-width: 0;
}

.app-layout-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
}

.app-layout-sider--overlay {
  z-index: 1001;
  max-height: 100dvh;
  box-sizing: border-box;
  padding-top: env(safe-area-inset-top, 0);
}

/* 移动端抽屉：菜单项最小点击高度（约 44px） */
.app-layout-sider--overlay :deep(.n-menu-item-content) {
  min-height: 44px;
  box-sizing: border-box;
}

.app-layout-body {
  position: relative;
  padding: 12px 12px 20px;
  box-sizing: border-box;
}

@media (min-width: 640px) {
  .app-layout-body {
    padding: 20px 20px 24px;
  }
}

@media (min-width: 900px) {
  .app-layout-body {
    padding: 24px;
  }
}
</style>
