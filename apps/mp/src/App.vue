<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { resolveSupportedLocale } from '@shipyard/shared';
import { useAuthStore } from '@/stores/auth';

const { locale } = useI18n();

onLaunch(async () => {
  const auth = useAuthStore();
  if (auth.accessToken) {
    await auth.fetchMe();
  }
  const resolved = resolveSupportedLocale(auth.user?.locale);
  locale.value = resolved === 'en' ? 'en' : 'zh-CN';
});
</script>

<style>
page {
  background-color: #f5f5f5;
}
</style>
