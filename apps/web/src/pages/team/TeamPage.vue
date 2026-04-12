<template>
  <div>
    <n-page-header title="团队成员">
      <template #extra>
        <n-button type="primary" @click="showInvite = true">+ 邀请成员</n-button>
      </template>
    </n-page-header>

    <n-data-table
      :columns="columns"
      :data="members"
      :loading="loading"
      style="margin-top: 16px"
    />

    <n-modal
      v-model:show="showInvite"
      title="邀请成员"
      preset="card"
      style="width: 440px"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <n-form :model="inviteForm" label-placement="left" label-width="70">
        <n-form-item label="邮箱">
          <n-input v-model:value="inviteForm.email" type="text" :input-props="{ type: 'email' }" />
        </n-form-item>
        <n-form-item label="角色">
          <n-select v-model:value="inviteForm.role" :options="roleOptions" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showInvite = false">取消</n-button>
          <n-button type="primary" :loading="inviting" @click="handleInvite">发送邀请</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed } from 'vue';
import TeamMemberRoleCell from '@/components/table/TeamMemberRoleCell.vue';
import TeamMemberActionsCell from '@/components/table/TeamMemberActionsCell.vue';
import { useRoute } from 'vue-router';
import {
  NPageHeader, NDataTable, NButton, NModal, NForm, NFormItem,
  NInput, NSelect, NSpace, useMessage, type DataTableColumns,
} from 'naive-ui';
import { useOrgTeam, type TeamMember } from '@/composables/team/useOrgTeam';
import { openDestructiveNameConfirm } from '@/ui/destructiveNameConfirm';

const route = useRoute();
const message = useMessage();
const orgSlug = computed(() => route.params['orgSlug'] as string);
const { members, loading, inviteMember: sendInvite, inviting, removeMember: removeMemberRequest } =
  useOrgTeam(orgSlug);
const showInvite = ref(false);
const inviteForm = ref({ email: '', role: 'developer' });

const roleOptions = [
  { label: 'Admin', value: 'admin' },
  { label: 'Developer', value: 'developer' },
  { label: 'Viewer', value: 'viewer' },
];

const roleTypeMap: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  owner: 'error', admin: 'warning', developer: 'info', viewer: 'default',
};

const columns: DataTableColumns<TeamMember> = [
  { title: '名称', key: 'name', render: (r) => r.user.name },
  { title: '邮箱', key: 'email', render: (r) => r.user.email },
  {
    title: '角色', key: 'role', width: 100,
    render: (r) =>
      h(TeamMemberRoleCell, {
        role: r.role,
        tagType: roleTypeMap[r.role] ?? 'default',
      }),
  },
  {
    title: '操作', key: 'actions', width: 80,
    render: (r) =>
      h(TeamMemberActionsCell, {
        canRemove: r.role !== 'owner',
        onRemove: () => void confirmRemoveMember(r),
      }),
  },
];

async function handleInvite() {
  try {
    await sendInvite(inviteForm.value);
    message.success('邀请已发送');
    showInvite.value = false;
  } catch {
    /* 接口错误由全局 axios 拦截器提示 */
  }
}

function confirmRemoveMember(member: TeamMember) {
  openDestructiveNameConfirm({
    title: '移除此成员？',
    description: `将把「${member.user.name}」从本组织移除，其将无法再访问该组织资源。`,
    expected: member.user.email,
    expectedLabel: '成员邮箱',
    positiveText: '移除',
    onConfirm: async () => {
      await removeMemberRequest(member.userId);
      message.success('成员已移除');
    },
  });
}
</script>
