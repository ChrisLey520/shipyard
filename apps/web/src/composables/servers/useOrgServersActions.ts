import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import {
  createServer,
  deleteServer as deleteServerApi,
  listServers,
  testServer,
  updateServer,
} from '@/api/servers';

export type { ServerItem } from '@/api/servers';

/** 组织下服务器 CRUD 与连通测试 */
export function useOrgServersActions(orgSlug: MaybeRefOrGetter<string>) {
  const org = computed(() => toValue(orgSlug));

  return {
    listServers: () => listServers(org.value),

    createServer: (payload: Record<string, unknown>) => createServer(org.value, payload),

    updateServer: (serverId: string, payload: Record<string, unknown>) =>
      updateServer(org.value, serverId, payload),

    deleteServer: (serverId: string) => deleteServerApi(org.value, serverId),

    testServer: (serverId: string) => testServer(org.value, serverId),
  };
}
