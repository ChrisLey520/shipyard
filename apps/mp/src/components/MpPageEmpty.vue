<template>
  <view
    class="mp-empty"
    :class="{
      'mp-empty--page': variant === 'page',
      'mp-empty--embed': variant === 'embed',
      'mp-empty--dense': dense,
      'mp-empty--dark': isDark,
    }"
  >
    <view class="mp-empty__panel">
      <view class="mp-empty__body">
        <slot>
          <text v-if="title" class="mp-empty__title">{{ title }}</text>
          <text v-if="description" class="mp-empty__desc">{{ description }}</text>
        </slot>
      </view>
      <view v-if="$slots.footer" class="mp-empty__footer">
        <slot name="footer" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useThemeStore } from '@/stores/theme';

withDefaults(
  defineProps<{
    /** page：在 mp-page-column-fill__grow 内占满剩余高度并垂直居中 */
    variant?: 'page' | 'embed';
    /** 紧凑高度，用于图表下提示、日志区等 */
    dense?: boolean;
    title?: string;
    description?: string;
  }>(),
  { variant: 'embed', dense: false },
);

const { isDark } = storeToRefs(useThemeStore());
</script>

<style scoped>
.mp-empty--page {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  box-sizing: border-box;
}

.mp-empty--embed {
  width: 100%;
  box-sizing: border-box;
  padding: 16rpx 0;
}

.mp-empty__panel {
  width: 100%;
  box-sizing: border-box;
  border: 2rpx solid rgba(15, 23, 42, 0.12);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx;
  min-height: 280rpx;
}

.mp-empty--embed .mp-empty__panel {
  min-height: 240rpx;
}

.mp-empty--dense .mp-empty__panel {
  min-height: 176rpx;
  padding: 32rpx 24rpx;
}

.mp-empty--embed.mp-empty--dense .mp-empty__panel {
  min-height: 128rpx;
  padding: 24rpx 20rpx;
}

.mp-empty--dark .mp-empty__panel {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

.mp-empty__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.mp-empty__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #0f172a;
  text-align: center;
}

.mp-empty__desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #64748b;
  text-align: center;
  line-height: 1.55;
  max-width: 560rpx;
}

.mp-empty--dark .mp-empty__title {
  color: rgba(255, 255, 255, 0.92);
}

.mp-empty--dark .mp-empty__desc {
  color: rgba(255, 255, 255, 0.55);
}

.mp-empty__footer {
  margin-top: 32rpx;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
