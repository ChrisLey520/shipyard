<template>
  <page-meta
    :background-text-style="pageMetaBgText"
    :background-color="pageMetaBg"
    :background-color-top="pageMetaBg"
    :root-background-color="pageMetaBg"
    :background-color-bottom="pageMetaBg"
  />
  <mp-theme-provider>
  <mp-custom-nav-bar />
  <view class="p-3 mp-tab-page--with-bottom-bar mp-page-column-fill">
    <OrgNavGrid v-if="orgSlug" scope="collaboration" :org-slug="orgSlug" />
    <view class="flex justify-end mb-2">
      <wd-button size="small" type="primary" @click="showInvite = true">邀请成员</wd-button>
    </view>
    <wd-loading v-if="loading" />
    <wd-cell-group v-else-if="members.length" border>
      <wd-cell
        v-for="m in members"
        :key="m.userId"
        :title="m.user.name"
        :label="`${m.user.email} · ${m.role}`"
        is-link
        @click="confirmRemove(m)"
      />
    </wd-cell-group>
    <view v-else class="mp-page-column-fill__grow">
      <mp-page-empty variant="page" title="暂无成员" />
    </view>

    <wd-popup v-model="showInvite" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <wd-input v-model="invite.email" label="邮箱" />
        <wd-input v-model="invite.role" label="角色" placeholder="如 member、admin" />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="submitInvite">发送邀请</wd-button>
        <wd-button block plain class="mt-2" @click="showInvite = false">取消</wd-button>
      </view>
    </wd-popup>
    <typed-destructive-confirm-host />
  </view>
  <mp-main-tab-bar :tab-index="2" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, watch } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useOrgTabEntryPage } from '@/composables/useOrgTabEntryPage';
import * as teamApi from '@/api/team';
import type { TeamMember } from '@/api/team';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';
import TypedDestructiveConfirmHost from '@/components/TypedDestructiveConfirmHost.vue';
import { openTypedDestructiveMp } from '@/composables/typedDestructiveConfirmMp';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();
const { t } = useI18n();
const { orgSlug, onShowEntry, onLoadEntry } = useOrgTabEntryPage(t);
const loading = ref(false);
const members = ref<TeamMember[]>([]);
const showInvite = ref(false);
const saving = ref(false);
const invite = ref({ email: '', role: 'member' });

onShow(onShowEntry);
onLoad((q) => onLoadEntry(q as Record<string, string | undefined>));

async function load() {
  if (!orgSlug.value) return;
  loading.value = true;
  try {
    members.value = await teamApi.listMembers(orgSlug.value);
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

watch(orgSlug, load, { immediate: true });

async function submitInvite() {
  if (!invite.value.email.trim()) {
    uni.showToast({ title: '请填写邮箱', icon: 'none' });
    return;
  }
  saving.value = true;
  try {
    await teamApi.inviteMember(orgSlug.value, {
      email: invite.value.email.trim(),
      role: invite.value.role.trim() || 'member',
    });
    uni.showToast({ title: '已发送', icon: 'success' });
    showInvite.value = false;
    invite.value = { email: '', role: 'member' };
    await load();
  } catch {
    // 全局 request 已提示
  } finally {
    saving.value = false;
  }
}

function confirmRemove(m: TeamMember) {
  openTypedDestructiveMp({
    title: '移除此成员？',
    description: `将把「${m.user.name}」从本组织移除，其将无法再访问该组织资源。`,
    expected: m.user.email,
    expectedLabel: '成员邮箱',
    positiveText: '移除',
    onConfirm: async () => {
      await teamApi.removeMember(orgSlug.value, m.userId);
      uni.showToast({ title: '已移除', icon: 'success' });
      await load();
    },
  });
}
</script>
