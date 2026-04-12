import { nextTick } from 'vue';
import type { QueryClient } from '@tanstack/vue-query';
import type { Router } from 'vue-router';
import type { MessageApi } from 'naive-ui';
import { URL_SLUG_VALIDATION_MESSAGE, isValidUrlSlug } from '@shipyard/shared';
import type {
  ProjectDetail,
  UpdatePipelineConfigPayload,
  UpdateProjectPayload,
} from '@/api/projects';
import type { ProjectEditFormValues } from '@/pages/projects/projectEditForm';

export type ProjectSettingsSaveApi = {
  updateProject: (currentSlug: string, body: UpdateProjectPayload) => Promise<unknown>;
  updatePipelineConfig: (projectSlugForPath: string, body: UpdatePipelineConfigPayload) => Promise<unknown>;
};

export function validateProjectEditForm(v: ProjectEditFormValues, message: MessageApi): boolean {
  if (!v.name || !v.slug) {
    message.error('请填写项目名称与 URL 标识');
    return false;
  }
  if (!isValidUrlSlug(v.slug)) {
    message.error(URL_SLUG_VALIDATION_MESSAGE);
    return false;
  }
  if (!v.installCommand.trim() || !v.buildCommand.trim() || !v.outputDir.trim()) {
    message.error('请填写安装命令、构建命令与输出目录');
    return false;
  }
  if (v.timeoutSeconds == null || v.timeoutSeconds < 60) {
    message.error('构建超时至少 60 秒');
    return false;
  }
  if (v.previewEnabled) {
    if (!v.previewServerId) {
      message.error('启用 PR 预览时请选择一个预览服务器');
      return false;
    }
    if (!v.previewBaseDomain.trim()) {
      message.error('请填写预览父域（如 preview.example.com）');
      return false;
    }
  }
  return true;
}

export type ProjectSettingsSaveContext = {
  orgSlug: string;
  slugBefore: string;
  project: ProjectDetail | null;
  api: ProjectSettingsSaveApi;
  queryClient: QueryClient;
  router: Router;
  message: MessageApi;
  refetchDetail: () => Promise<unknown>;
  refetchDeployments: () => Promise<unknown>;
  loadBuildEnv: () => Promise<unknown>;
  /** slug 变更后 `router.replace` 的目标路径 */
  pathAfterSlugChange: (newSlug: string) => string;
  onSuccess?: () => void;
};

/**
 * 与 ProjectDetailPage.saveProject 等价的持久化逻辑（Modal / 设置页共用）
 */
export async function saveProjectSettings(
  v: ProjectEditFormValues,
  ctx: ProjectSettingsSaveContext,
): Promise<boolean> {
  if (!validateProjectEditForm(v, ctx.message)) return false;
  try {
    await ctx.api.updateProject(ctx.slugBefore, {
      name: v.name,
      slug: v.slug,
      frameworkType: v.frameworkType,
      previewEnabled: v.previewEnabled,
      previewServerId: v.previewEnabled ? v.previewServerId : null,
      previewBaseDomain: v.previewEnabled ? v.previewBaseDomain.trim() : null,
    });
    const slugAfter = v.slug;

    if (ctx.project?.pipelineConfig) {
      await ctx.api.updatePipelineConfig(slugAfter, {
        installCommand: v.installCommand.trim(),
        buildCommand: v.buildCommand.trim(),
        outputDir: v.outputDir.trim(),
        nodeVersion: v.nodeVersion,
        cacheEnabled: v.cacheEnabled,
        timeoutSeconds: v.timeoutSeconds,
        lintCommand: v.lintCommand.trim() ? v.lintCommand.trim() : null,
        testCommand: v.testCommand.trim() ? v.testCommand.trim() : null,
        ssrEntryPoint: v.frameworkType === 'ssr' ? (v.ssrEntryPoint.trim() || null) : null,
        previewHealthCheckPath:
          v.frameworkType === 'ssr' && v.previewHealthCheckPath.trim()
            ? v.previewHealthCheckPath.trim()
            : null,
        containerImageEnabled: v.containerImageEnabled,
        containerImageName: v.containerImageEnabled ? v.containerImageName.trim() || null : null,
        ...(v.registryPassword.trim()
          ? {
              containerRegistryAuth: {
                username: v.registryUsername.trim() || undefined,
                password: v.registryPassword.trim(),
              },
            }
          : {}),
      });
    }

    ctx.message.success('已保存');
    ctx.onSuccess?.();
    void ctx.queryClient.invalidateQueries({ queryKey: ['projects', 'list', ctx.orgSlug] });
    if (v.slug !== ctx.slugBefore) {
      void ctx.queryClient.invalidateQueries({
        queryKey: ['projects', 'detail', ctx.orgSlug, ctx.slugBefore],
      });
      void ctx.queryClient.invalidateQueries({
        queryKey: ['projects', 'deployments', ctx.orgSlug, ctx.slugBefore],
      });
      await ctx.router.replace(ctx.pathAfterSlugChange(v.slug));
      await nextTick();
    }
    await ctx.refetchDetail();
    await ctx.refetchDeployments();
    await ctx.loadBuildEnv();
    return true;
  } catch {
    return false;
  }
}
