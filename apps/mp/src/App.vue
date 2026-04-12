<script setup lang="ts">
import { watch } from 'vue';
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { resolveSupportedLocale } from '@shipyard/shared';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { storage } from '@/utils/storage';
import { isUniMiniProgramRuntime } from '@/utils/uniPlatform';

const { locale } = useI18n();
const themeStore = useThemeStore();
const auth = useAuthStore();

const isUniMp = isUniMiniProgramRuntime();

watch(
  () => auth.user,
  (u) => {
    if (!u) return;
    themeStore.applyFromUserProfile({
      themeId: u.themeId ?? null,
      colorMode: u.colorMode ?? null,
    });
  },
  { immediate: true },
);

onLaunch(() => {
  themeStore.hydrateFromStorage();
  themeStore.subscribeHostThemeChange();

  /** 小程序首帧后补一次状态栏样式（自定义底栏无原生 TabBar） */
  if (isUniMp) {
    const syncChrome = () => {
      themeStore.applyNativeChrome();
    };
    setTimeout(syncChrome, 0);
    setTimeout(syncChrome, 150);
  }

  const auth = useAuthStore();
  /** 本地优先：用户在「我的」选语言后立即写入 storage，Tab 切页仍生效 */
  const applyLocale = () => {
    const stored = storage.getLocale();
    if (stored === 'en' || stored === 'zh-CN') {
      locale.value = stored;
      return;
    }
    const resolved = resolveSupportedLocale(auth.user?.locale);
    locale.value = resolved === 'en' ? 'en' : 'zh-CN';
  };
  applyLocale();
  // 勿在 onLaunch 里 await 远程接口：API 不可达时会长时间阻塞，开发者工具易报 Launch timeout
  if (auth.accessToken) {
    void auth.fetchMe().finally(() => applyLocale());
  }
});

onShow(() => {
  /** 从后台回前台或首显时补一次状态栏（与主题 storage 一致） */
  if (isUniMp) {
    themeStore.applyNativeChrome();
  }
});

</script>

<style>
/* 与 MpThemeProvider 浅色实色一致；深色主背景由 surface 实色承担（page 仅兜底首屏） */
page {
  height: 100%;
  background-color: #eaedf6;
}

/*
 * Wot 弹层内联 z-index 默认为 10；自定义顶栏曾为 2000 时会压住个人设置等页的 ActionSheet、Popup。
 * 用 !important 压过内联，保证遮罩与面板在顶栏之上。
 */
.wd-overlay {
  z-index: 9000 !important;
}
.wd-popup {
  z-index: 9001 !important;
}

/* 纵向 flex + 最小屏高，配合 MpPageEmpty variant=page 占满剩余区域（H5 / 小程序通用） */
.mp-page-column-fill {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 100vh;
}

.mp-page-column-fill__grow {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* #ifdef MP-WEIXIN */
/* 主 Tab 页：为固定底栏留出空间（与 MpMainTabBar 高度 + 安全区一致） */
.mp-tab-page--with-bottom-bar {
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
/* #endif */
</style>
