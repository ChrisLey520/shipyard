<template>
  <!-- 勿用 import.meta.env.UNI_PLATFORM 做 v-if：vite 编译到小程序时常被替换成空对象，导致整栏不渲染 -->
  <!-- #ifdef MP -->
  <view class="mp-main-tabbar" :style="barStyle">
    <view v-for="(item, index) in items" :key="item.route" class="mp-main-tabbar__item" @click="onTap(index)">
      <image
        class="mp-main-tabbar__icon"
        :src="tabIndex === index ? item.iconOn : item.icon"
        mode="aspectFit"
      />
      <text class="mp-main-tabbar__label" :style="{ color: labelColor(index) }">{{ t(item.i18nKey) }}</text>
    </view>
  </view>
  <!-- #endif -->
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/theme';
import { darkTabBarBackground } from '@/theme/darkPalette';
import { MP_CUSTOM_TAB_ITEMS } from '@/utils/mpCustomTabBar';

const props = defineProps<{
  /** 当前 Tab 在 MP_CUSTOM_TAB_ITEMS 中的下标 */
  tabIndex: number;
}>();

const { t } = useI18n();
const themeStore = useThemeStore();
const { isDark, themeId, accentHex } = storeToRefs(themeStore);

const items = MP_CUSTOM_TAB_ITEMS;

const barStyle = computed(() => {
  const bg = isDark.value ? darkTabBarBackground[themeId.value] : '#eaedf6';
  const border = isDark.value ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)';
  return {
    backgroundColor: bg,
    borderTopColor: border,
  };
});

function labelColor(i: number) {
  const active = props.tabIndex === i;
  return active ? accentHex.value : isDark.value ? '#94a3b8' : '#666666';
}

function onTap(i: number) {
  if (i === props.tabIndex) return;
  uni.switchTab({ url: items[i].switchPath });
}
</script>

<style scoped>
.mp-main-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 400;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  justify-content: space-around;
  border-top-width: 1px;
  border-top-style: solid;
  padding-top: 8rpx;
  padding-bottom: calc(8rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(8rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.mp-main-tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  padding: 0 4rpx;
}

.mp-main-tabbar__icon {
  width: 48rpx;
  height: 48rpx;
}

.mp-main-tabbar__label {
  margin-top: 4rpx;
  font-size: 20rpx;
  line-height: 1.2;
}
</style>
