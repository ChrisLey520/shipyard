<template>
  <view class="org-nav-root" :class="{ 'org-nav-root--dark': isDark }">
    <wd-tabs
      v-model="tabIndex"
      :animated="false"
      slidable="always"
      :swipeable="false"
      :map-num="99"
      custom-class="org-nav-tabs-bar"
      @click="onTabClick"
    >
      <wd-tab v-for="(it, i) in navItems" :key="i" :title="it.label" :name="i">
        <view class="org-nav-tab-panel" />
      </wd-tab>
    </wd-tabs>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useOrgStore } from '@/stores/org';
import { useThemeStore } from '@/stores/theme';

const props = defineProps<{
  orgSlug: string;
  /** 部署：项目 / 服务器 / Git；协作：团队 / 审批 */
  scope: 'deployment' | 'collaboration';
}>();

const orgStore = useOrgStore();
const themeStore = useThemeStore();
const { isDark } = storeToRefs(themeStore);
const { t } = useI18n();

const tabIndex = ref(0);

/** 微信 TabBar 页必须在主包 pages 中，须用 switchTab（不可带 query） */
const SWITCH_TAB_PATHS = new Set(['/pages/deployment/index', '/pages/collaboration/index']);

const navItems = computed(() => {
  const o = encodeURIComponent(props.orgSlug);
  const pkg = `/package-org/pages`;
  if (props.scope === 'collaboration') {
    return [
      { label: t('org.team'), path: `/pages/collaboration/index?orgSlug=${o}` },
      { label: t('org.approvals'), path: `${pkg}/approvals/index?orgSlug=${o}` },
    ];
  }
  return [
    { label: t('org.projects'), path: `/pages/deployment/index?orgSlug=${o}` },
    { label: t('org.servers'), path: `${pkg}/servers/index?orgSlug=${o}` },
    { label: t('nav.gitShort'), path: `${pkg}/git-accounts/index?orgSlug=${o}` },
  ];
});

function currentRoute(): string {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1] as { route?: string } | undefined;
  return cur?.route ?? '';
}

function resolveActiveTabIndex(): number | null {
  const route = currentRoute();
  if (props.scope === 'deployment') {
    if (
      route.includes('pages/deployment/index') ||
      route.includes('projects/new') ||
      route.includes('projects/detail') ||
      route.includes('deployment-detail')
    ) {
      return 0;
    }
    if (route.includes('servers/index')) return 1;
    if (route.includes('git-accounts')) return 2;
    return null;
  }
  if (route.includes('pages/collaboration/index')) return 0;
  if (route.includes('approvals/index')) return 1;
  return null;
}

function syncTabFromRoute() {
  const idx = resolveActiveTabIndex();
  tabIndex.value = idx === null ? 0 : idx;
}

onMounted(() => {
  syncTabFromRoute();
});

onShow(() => {
  syncTabFromRoute();
});

watch(
  () => props.orgSlug,
  () => syncTabFromRoute(),
);

watch(
  () => props.scope,
  () => syncTabFromRoute(),
);

function shouldSkipNavigate(index: number): boolean {
  const r = resolveActiveTabIndex();
  return r !== null && r === index;
}

/**
 * 当前已在分包内的组织子页时，顶栏 Tab 互应用 redirectTo，避免每次切换都 navigateTo 压栈。
 * 从主包 Tab 根页（部署/协作首页）首次进分包仍用 navigateTo，保留「返回」回到首页。
 */
function shouldReplaceOrgNavHistory(route: string, scope: 'deployment' | 'collaboration'): boolean {
  if (scope === 'deployment') {
    if (route.includes('pages/deployment/index')) return false;
    return (
      route.includes('servers/index') ||
      route.includes('git-accounts') ||
      route.includes('projects/new') ||
      route.includes('projects/detail') ||
      route.includes('deployment-detail')
    );
  }
  // 协作：审批为唯一分包子页，与团队用 switchTab，无同级分包 Tab 互跳
  return false;
}

function onTabClick(payload: { index: number }) {
  const { index } = payload;
  if (shouldSkipNavigate(index)) return;
  const it = navItems.value[index];
  if (!it) return;
  orgStore.setCurrentOrg(props.orgSlug);
  const pathOnly = it.path.split('?')[0] ?? it.path;
  if (SWITCH_TAB_PATHS.has(pathOnly)) {
    uni.switchTab({ url: pathOnly });
    return;
  }
  const route = currentRoute();
  if (shouldReplaceOrgNavHistory(route, props.scope)) {
    uni.redirectTo({ url: it.path });
    return;
  }
  uni.navigateTo({ url: it.path });
}
</script>

<style scoped>
.org-nav-root {
  margin-bottom: 12px;
}

.org-nav-tab-panel {
  height: 0;
  min-height: 0;
  overflow: hidden;
}

.org-nav-root :deep(.wd-tabs__container) {
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

.org-nav-root :deep(.wd-tabs__body) {
  min-height: 0 !important;
}

/* 深色：补全 Wot Tabs 在小程序子组件上的字色（尤其横向滚动时右侧未选中项） */
.org-nav-root--dark :deep(.wd-tabs) {
  background: transparent;
}
.org-nav-root--dark :deep(.wd-tabs__nav) {
  background: transparent;
}
.org-nav-root--dark :deep(.wd-tabs__nav-item:not(.is-active)) {
  color: rgba(255, 255, 255, 0.55);
}
.org-nav-root--dark :deep(.wd-tabs__nav-item.is-active) {
  color: var(--wot-color-theme, #22c55e);
}
.org-nav-root--dark :deep(.wd-tabs__line) {
  background: var(--wot-color-theme, #22c55e) !important;
}
.org-nav-root--dark :deep(.wd-tabs__map-btn) {
  color: rgba(255, 255, 255, 0.65);
  background: transparent;
}
.org-nav-root--dark :deep(.wd-tabs__map-btn::before) {
  /* 浅色 Tabs 在右侧用白底渐变「盖住」滚动内容；深色下改为弱渐变以免出现白边 */
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.45));
}
.org-nav-root--dark :deep(.wd-tabs__map-header) {
  color: rgba(255, 255, 255, 0.88);
  background: transparent;
}
.org-nav-root--dark :deep(.wd-tabs__map-body) {
  background: transparent;
}
.org-nav-root--dark :deep(.wd-tabs__map-nav-btn:not(.is-active)) {
  color: rgba(255, 255, 255, 0.6);
  background-color: rgba(255, 255, 255, 0.08);
}
.org-nav-root--dark :deep(.wd-tabs__map-nav-btn.is-active) {
  color: var(--wot-color-theme, #22c55e);
  background-color: rgba(255, 255, 255, 0.06);
}
</style>
