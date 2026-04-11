import { useQuery } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { listProjectNotifications } from '@/api/projects/notifications';

export function useProjectNotificationsQuery(orgSlug: Ref<string>, projectSlug: Ref<string>) {
  return useQuery({
    queryKey: computed(() => ['projects', 'notifications', orgSlug.value, projectSlug.value] as const),
    queryFn: () => listProjectNotifications(orgSlug.value, projectSlug.value),
    enabled: computed(() => Boolean(orgSlug.value && projectSlug.value)),
  });
}
