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
    <wd-loading v-if="loading" />
    <wd-cell-group v-else-if="items.length" border>
      <wd-cell
        v-for="a in items"
        :key="a.id"
        :title="a.deployment?.branch ?? a.deploymentId"
        :label="statusLine(a)"
        is-link
        @click="openReview(a)"
      />
    </wd-cell-group>
    <view v-else class="mp-page-column-fill__grow">
      <mp-page-empty variant="page" title="暂无审批" />
    </view>

    <wd-popup v-model="showReview" position="bottom" :safe-area-inset-bottom="true">
      <view class="p-4">
        <text class="text-sm text-gray-600">{{ reviewTarget?.deployment?.commitMessage }}</text>
        <wd-textarea v-model="comment" class="mt-2" placeholder="备注（可选）" />
        <wd-button block type="primary" class="mt-3" :loading="saving" @click="decide('approved')">
          通过
        </wd-button>
        <wd-button block plain custom-class="mt-2" type="error" @click="decide('rejected')">
          拒绝
        </wd-button>
        <wd-button block plain class="mt-2" @click="showReview = false">取消</wd-button>
      </view>
    </wd-popup>
  </view>
  <mp-main-tab-bar :tab-index="2" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as approvalsApi from '@/package-org/api/approvals';
import type { ApprovalItem } from '@/package-org/api/approvals';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import OrgNavGrid from '@/components/org/OrgNavGrid.vue';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const loading = ref(false);
const items = ref<ApprovalItem[]>([]);
const showReview = ref(false);
const reviewTarget = ref<ApprovalItem | null>(null);
const comment = ref('');
const saving = ref(false);

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

function statusLine(a: ApprovalItem) {
  const env = a.deployment?.environment?.name;
  return [a.status, env, a.requestedBy?.name].filter(Boolean).join(' · ');
}

async function load() {
  if (!orgSlug.value) return;
  loading.value = true;
  try {
    items.value = await approvalsApi.listApprovals(orgSlug.value);
  } catch {
    // 全局 request 已提示
  } finally {
    loading.value = false;
  }
}

watch(orgSlug, load, { immediate: true });

function openReview(a: ApprovalItem) {
  if (a.status !== 'pending') {
    uni.showToast({ title: '该审批已处理', icon: 'none' });
    return;
  }
  reviewTarget.value = a;
  comment.value = '';
  showReview.value = true;
}

async function decide(decision: 'approved' | 'rejected') {
  const t = reviewTarget.value;
  if (!t) return;
  saving.value = true;
  try {
    await approvalsApi.reviewApproval(orgSlug.value, t.id, {
      decision,
      comment: comment.value.trim() || undefined,
    });
    uni.showToast({ title: '已提交', icon: 'success' });
    showReview.value = false;
    await load();
  } catch {
    // 全局 request 已提示
  } finally {
    saving.value = false;
  }
}
</script>
