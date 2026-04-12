import type { ProjectDetail } from '@/api/projects';

/** 项目编辑表单（Modal 与项目设置页共用） */
export type ProjectEditFormValues = {
  name: string;
  slug: string;
  frameworkType: string;
  installCommand: string;
  buildCommand: string;
  lintCommand: string;
  testCommand: string;
  outputDir: string;
  nodeVersion: string;
  cacheEnabled: boolean;
  timeoutSeconds: number;
  ssrEntryPoint: string;
  /** PR 预览 SSR 健康检查 path，空则 / */
  previewHealthCheckPath: string;
  previewEnabled: boolean;
  previewServerId: string | null;
  previewBaseDomain: string;
  containerImageEnabled: boolean;
  containerImageName: string;
  registryUsername: string;
  registryPassword: string;
};

export function emptyProjectEditForm(): ProjectEditFormValues {
  return {
    name: '',
    slug: '',
    frameworkType: 'static',
    installCommand: 'pnpm install',
    buildCommand: 'pnpm build',
    lintCommand: '',
    testCommand: '',
    outputDir: 'dist',
    nodeVersion: '20',
    cacheEnabled: true,
    timeoutSeconds: 900,
    ssrEntryPoint: 'dist/index.js',
    previewHealthCheckPath: '',
    previewEnabled: false,
    previewServerId: null,
    previewBaseDomain: '',
    containerImageEnabled: false,
    containerImageName: '',
    registryUsername: '',
    registryPassword: '',
  };
}

/** 从项目详情填充表单（密码字段始终空，由用户按需填写） */
export function projectDetailToEditForm(project: ProjectDetail | null): ProjectEditFormValues {
  if (!project) return emptyProjectEditForm();
  const pc = project.pipelineConfig;
  const p = project;
  return {
    name: p.name ?? '',
    slug: p.slug ?? '',
    frameworkType: p.frameworkType ?? 'static',
    installCommand: pc?.installCommand ?? 'pnpm install',
    buildCommand: pc?.buildCommand ?? 'pnpm build',
    lintCommand: pc?.lintCommand ?? '',
    testCommand: pc?.testCommand ?? '',
    outputDir: pc?.outputDir ?? 'dist',
    nodeVersion: pc?.nodeVersion ?? '20',
    cacheEnabled: pc?.cacheEnabled ?? true,
    timeoutSeconds: pc?.timeoutSeconds ?? 900,
    ssrEntryPoint: pc?.ssrEntryPoint ?? 'dist/index.js',
    previewHealthCheckPath: pc?.previewHealthCheckPath ?? '',
    previewEnabled: p.previewEnabled ?? false,
    previewServerId: p.previewServerId ?? null,
    previewBaseDomain: p.previewBaseDomain ?? '',
    containerImageEnabled: pc?.containerImageEnabled ?? false,
    containerImageName: pc?.containerImageName ?? '',
    registryUsername: '',
    registryPassword: '',
  };
}
