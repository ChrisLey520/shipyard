<template>
  <view class="mp-cnav-wrap">
    <view
      class="mp-cnav-fixed"
      :class="isDark ? 'mp-cnav-fixed--dark' : 'mp-cnav-fixed--light'"
      :style="fixedStyle"
    >
      <view class="mp-cnav-row" :style="{ height: `${layout.navContentHeight}px` }">
        <view class="mp-cnav-left">
          <view v-if="resolvedShowBack" class="mp-cnav-back-hit" @click="onBack">
            <text class="mp-cnav-back-icon">‹</text>
          </view>
        </view>
        <view class="mp-cnav-title-wrap">
          <text class="mp-cnav-title">{{ resolvedTitle }}</text>
        </view>
        <view class="mp-cnav-right" :style="{ width: `${layout.rightInset}px` }" />
      </view>
    </view>
    <view class="mp-cnav-spacer" :style="{ height: `${layout.totalHeight}px` }" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useThemeStore } from '@/stores/theme';
import { darkHeaderBackground } from '@/theme/darkPalette';
import { getMpPageNavTitle } from '@/utils/mpPageNavTitles';
import { isCurrentPageTabBar } from '@/utils/tabBarPages';
import { readMpNavBarLayout } from '@/composables/useMpNavBarLayout';

const props = defineProps<{
  title?: string;
  showBack?: boolean;
}>();

const themeStore = useThemeStore();
const { isDark, themeId } = storeToRefs(themeStore);
const layout = readMpNavBarLayout();

const fixedStyle = computed(() => {
  const base: Record<string, string> = {
    height: `${layout.totalHeight}px`,
    paddingTop: `${layout.statusBarHeight}px`,
  };
  if (isDark.value) {
    base.backgroundColor = darkHeaderBackground[themeId.value];
  }
  return base;
});

const routeForBack = computed(() => {
  try {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1] as { route?: string } | undefined;
    return (cur?.route ?? '').replace(/^\//, '');
  } catch {
    return '';
  }
});

const autoShowBack = computed(() => {
  if (isCurrentPageTabBar()) return false;
  if (routeForBack.value === 'pages/auth/login') return false;
  return true;
});

const resolvedShowBack = computed(() => (props.showBack !== undefined ? props.showBack : autoShowBack.value));

const resolvedTitle = computed(() => props.title ?? getMpPageNavTitle());

function onBack() {
  uni.navigateBack({
    fail() {
      uni.reLaunch({ url: '/pages/workspace/dashboard' });
    },
  });
}
</script>

<style scoped>
.mp-cnav-fixed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* 须低于 Wot 弹层（wd-popup 默认 z-index:10，过高会挡住 ActionSheet / Popup） */
  z-index: 500;
  box-sizing: border-box;
}
.mp-cnav-fixed--light {
  background-color: #eaedf6;
}
.mp-cnav-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  position: relative;
}
.mp-cnav-left {
  min-width: 72rpx;
  padding-left: 8rpx;
  z-index: 2;
  display: flex;
  align-items: center;
}
.mp-cnav-back-hit {
  padding: 12rpx 20rpx 12rpx 12rpx;
}
.mp-cnav-back-icon {
  font-size: 48rpx;
  font-weight: 300;
  line-height: 1;
  color: #000000;
}
.mp-cnav-fixed--dark .mp-cnav-back-icon {
  color: #ffffff;
}
.mp-cnav-title-wrap {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.mp-cnav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #000000;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-cnav-fixed--dark .mp-cnav-title {
  color: #ffffff;
}
.mp-cnav-right {
  flex-shrink: 0;
  z-index: 2;
}
.mp-cnav-spacer {
  width: 100%;
  flex-shrink: 0;
}
</style>
