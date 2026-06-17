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
    <wd-loading v-if="accountsLoading" />

    <view v-else-if="!accounts.length" class="mp-page-column-fill__grow">
      <mp-page-empty
        variant="page"
        :title="t('projectNew.emptyGitTitle')"
        :description="t('projectNew.emptyGitHint')"
      >
        <template #footer>
          <wd-button type="primary" block @click="goAddGitAccount">
            {{ t('projectNew.addGitAccountCta') }}
          </wd-button>
        </template>
      </mp-page-empty>
    </view>

    <view v-else>
      <wd-cell-group border>
        <wd-cell
          :title="t('projectNew.gitAccount')"
          is-link
          :value="gitAccountLabel"
          @click="openGitAccountSheet"
        />
      </wd-cell-group>

      <view v-if="form.gitAccountId" class="mt-3">
        <wd-input v-model="form.name" :label="t('projectNew.name')" :placeholder="t('projectNew.namePh')" />
        <wd-input v-model="form.slug" :label="t('projectNew.slug')" :placeholder="t('projectNew.slugPh')" />
        <wd-input
          v-model="form.repoFullName"
          :label="t('projectNew.repo')"
          :placeholder="t('projectNew.repoPh')"
        />
        <wd-input
          v-model="form.frameworkType"
          :label="t('projectNew.framework')"
          placeholder="static / ssr / nodejs"
        />
        <wd-input v-model="form.installCommand" :label="t('projectNew.installCmd')" />
        <wd-input v-model="form.buildCommand" :label="t('projectNew.buildCmd')" />
        <wd-input v-model="form.outputDir" :label="t('projectNew.outputDir')" />
        <wd-input
          v-model="form.nodeVersion"
          :label="t('projectNew.nodeVersion')"
          :placeholder="t('projectNew.nodeVersionPh')"
        />
        <wd-input
          v-if="form.frameworkType.trim() !== 'static'"
          v-model="form.ssrEntryPoint"
          :label="form.frameworkType.trim() === 'nodejs' ? 'Node 入口' : 'SSR 入口'"
          :placeholder="form.frameworkType.trim() === 'nodejs' ? 'dist/main.js' : 'dist/index.js'"
        />
        <wd-input
          v-if="form.frameworkType.trim() !== 'static'"
          v-model="form.servicePort"
          label="服务端口"
          type="number"
        />
        <wd-button block type="primary" class="mt-4" :loading="submitting" @click="submit">
          {{ t('projectNew.create') }}
        </wd-button>
      </view>
    </view>

    <wd-action-sheet
      v-model="showGitAccountSheet"
      :actions="gitAccountActions"
      :cancel-text="t('common.cancel')"
      @select="onGitAccountSheetSelect"
    />
  </view>
  <mp-main-tab-bar :tab-index="1" />
  </mp-theme-provider>
</template>

<script setup lang="ts">
import { useMpPageRootMeta } from '@/composables/useMpPageRootMeta';
import { ref, watch, computed } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useOrgPageContext } from '@/composables/useOrgPageContext';
import * as projectsApi from '@/api/projects';
import * as gitApi from '@/package-org/api/git-accounts';
import type { GitAccountItem } from '@/package-org/api/git-accounts';
import MpPageEmpty from '@/components/MpPageEmpty.vue';
import { deriveRuntimeEntryPointForFramework, slugifyFromDisplayName } from '@shipyard/shared';

const { pageMetaBg, pageMetaBgText } = useMpPageRootMeta();

const { t } = useI18n();
const { orgSlug, initOrgFromQuery } = useOrgPageContext();
const submitting = ref(false);
const accountsLoading = ref(false);
const accounts = ref<GitAccountItem[]>([]);
const showGitAccountSheet = ref(false);

const form = ref({
  name: '',
  slug: '',
  gitAccountId: '',
  repoFullName: '',
  frameworkType: 'static',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  outputDir: 'dist',
  nodeVersion: '20',
  ssrEntryPoint: '',
  servicePort: '3000',
});

const gitAccountActions = computed(() =>
  accounts.value.map((g) => ({
    name: `${g.name}（${g.gitProvider}）`,
    gitAccountId: g.id,
  })),
);

const gitAccountLabel = computed(() => {
  const id = form.value.gitAccountId;
  if (!id) return t('projectNew.pickGitAccount');
  const g = accounts.value.find((a) => a.id === id);
  return g ? `${g.name}（${g.gitProvider}）` : t('projectNew.pickGitAccount');
});

onLoad((q) => {
  initOrgFromQuery(q as Record<string, string | undefined>);
});

async function loadGitAccounts() {
  if (!orgSlug.value) return;
  accountsLoading.value = true;
  try {
    const list = await gitApi.listGitAccounts(orgSlug.value);
    accounts.value = list;
    const sel = form.value.gitAccountId;
    if (sel && !list.some((a) => a.id === sel)) {
      form.value.gitAccountId = '';
    }
    if (list.length === 1) {
      form.value.gitAccountId = list[0].id;
    }
  } catch {
    accounts.value = [];
  } finally {
    accountsLoading.value = false;
  }
}

watch(orgSlug, loadGitAccounts, { immediate: true });

onShow(() => {
  if (orgSlug.value) void loadGitAccounts();
});

watch(
  () => form.value.name,
  (n) => {
    form.value.slug = slugifyFromDisplayName(n);
  },
);

watch(
  () => form.value.frameworkType,
  (next, prev) => {
    if (!next || next === prev) return;
    form.value.ssrEntryPoint = deriveRuntimeEntryPointForFramework(
      next.trim(),
      form.value.ssrEntryPoint,
      prev?.trim(),
    );
  },
);

function goAddGitAccount() {
  const o = encodeURIComponent(orgSlug.value);
  uni.navigateTo({ url: `/package-org/pages/git-accounts/index?orgSlug=${o}` });
}

function openGitAccountSheet() {
  if (gitAccountActions.value.length <= 1) {
    if (gitAccountActions.value.length === 1) {
      form.value.gitAccountId = gitAccountActions.value[0].gitAccountId;
    }
    return;
  }
  showGitAccountSheet.value = true;
}

function onGitAccountSheetSelect(payload: { item: { name: string; gitAccountId?: string } }) {
  const id = payload.item.gitAccountId;
  if (!id) return;
  form.value.gitAccountId = id;
}

async function submit() {
  const f = form.value;
  if (!f.gitAccountId.trim()) {
    uni.showToast({ title: t('projectNew.fillGitFirst'), icon: 'none' });
    return;
  }
  if (!f.name.trim() || !f.slug.trim() || !f.repoFullName.trim()) {
    uni.showToast({ title: t('projectNew.fillNameSlugRepo'), icon: 'none' });
    return;
  }
  if (f.frameworkType.trim() !== 'static') {
    const port = Number(f.servicePort);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      uni.showToast({ title: '服务端口须为 1-65535', icon: 'none' });
      return;
    }
  }
  const payload: Record<string, unknown> = {
    name: f.name.trim(),
    slug: f.slug.trim(),
    repoFullName: f.repoFullName.trim(),
    gitAccountId: f.gitAccountId.trim(),
    frameworkType: f.frameworkType.trim() || 'static',
    installCommand: f.installCommand.trim() || 'pnpm install',
    buildCommand: f.buildCommand.trim() || 'pnpm build',
    outputDir: f.outputDir.trim() || 'dist',
    nodeVersion: f.nodeVersion.trim() || '20',
    ssrEntryPoint: f.frameworkType.trim() === 'static' ? null : f.ssrEntryPoint.trim() || null,
    servicePort: f.frameworkType.trim() === 'static' ? 3000 : Number(f.servicePort) || 3000,
  };

  submitting.value = true;
  try {
    await projectsApi.createProject(orgSlug.value, payload);
    uni.showToast({ title: t('projectNew.created'), icon: 'success' });
    setTimeout(() => {
      uni.navigateBack();
    }, 400);
  } catch {
    // 全局 request 已提示
  } finally {
    submitting.value = false;
  }
}
</script>
