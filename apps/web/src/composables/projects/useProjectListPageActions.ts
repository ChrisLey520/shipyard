import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import {
  deleteProject,
  getProject,
  updatePipelineConfig,
  updateProject,
  type UpdateProjectPayload,
} from '@/api/projects';

export type { ProjectDetail, ProjectListItem } from '@/api/projects';

/** 项目列表页：编辑弹窗拉详情、保存、删除（页面不直接 import api） */
export function useProjectListPageActions(orgSlug: MaybeRefOrGetter<string>) {
  const org = computed(() => toValue(orgSlug));

  return {
    fetchProjectDetail: (projectSlug: string) => getProject(org.value, projectSlug),

    deleteProject: (projectSlug: string) => deleteProject(org.value, projectSlug),

    updateProject: (currentSlug: string, body: UpdateProjectPayload) =>
      updateProject(org.value, currentSlug, body),

    updatePipelineConfig: (
      projectSlugForPath: string,
      body: Parameters<typeof updatePipelineConfig>[2],
    ) => updatePipelineConfig(org.value, projectSlugForPath, body),
  };
}
