# Shipyard 项目新建框架类型和 Monorepo 工作目录完整指南

## 1. 框架类型枚举定义

**文件**: `packages/shared/src/enums.ts` (第 25-29 行)

```typescript
export enum FrameworkType {
  STATIC = 'static',      // 静态站点（SSG/SPA）
  SSR = 'ssr',            // 服务端渲染
  NODEJS = 'nodejs',      // Node.js 后端服务
}
```

**各框架类型含义：**

| 框架类型 | 值 | 场景 | 构建产物 | 运行方式 |
|---------|-----|------|--------|--------|
| 静态站点 | `static` | Vite/Webpack SPA、Next.js 静态导出 | HTML/JS/CSS 静态文件 | 静态 Web 服务器或本机 PM2 |
| SSR | `ssr` | Next.js、Nuxt、Express+Vue | 可执行的 SSR 服务器 + 产物 | PM2/Node 运行时（需启动脚本） |
| Node 后端 | `nodejs` | Express、NestJS、Fastify | 可执行的 Node 应用 | PM2/Node 运行时 + 服务端口 |

---

## 2. 数据模型定义

### 2.1 项目表 (Project)

**文件**: `apps/server/prisma/schema.prisma` (第 131-164 行)

关键字段：
- `frameworkType: String` - 框架类型（enum 值）
- `repoFullName: String` - Git 仓库 owner/repo
- `previewEnabled: Boolean` - PR 预览总开关
- `previewServerId: String?` - 预览部署目标服务器

### 2.2 构建配置表 (PipelineConfig)

**文件**: `apps/server/prisma/schema.prisma` (第 166-192 行)

```prisma
model PipelineConfig {
  id                    String    @id @default(uuid())
  projectId             String    @unique
  installCommand        String    @default("pnpm install")
  buildCommand          String    @default("pnpm build")
  lintCommand           String?
  testCommand           String?
  workingDirectory      String?   // ← monorepo 子应用工作目录（v6900623 新增）
  outputDir             String    @default("dist")
  nodeVersion           String    @default("20")
  cacheEnabled          Boolean   @default(true)
  timeoutSeconds        Int       @default(900)
  ssrEntryPoint         String?   // SSR/Node 入口文件
  servicePort           Int       @default(3000)
  previewHealthCheckPath String?
  containerImageEnabled Boolean   @default(false)
  containerImageName    String?
  containerRegistryAuthEncrypted String? @db.Text
  updatedAt             DateTime  @updatedAt
  
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

**workingDirectory 说明**（提交 `6900623`）：
- 若为空/null → 使用仓库根目录
- 若有值 → 相对仓库根的子目录，如 `apps/web`、`packages/backend`
- 验证：禁止 `/` 开头、禁止 `..`、禁止包含绝对路径
- 用途：支持 monorepo 中多个独立应用的构建

---

## 3. 创建项目的 API 和 DTO

### 3.1 前端调用接口

**文件**: `apps/web/src/api/projects/index.ts`

```typescript
export async function createProject(orgSlug: string, payload: Record<string, unknown>) {
  return http.post(`/orgs/${orgSlug}/projects`, payload).then((r) => r.data);
}

export async function createProjectsBulk(
  orgSlug: string,
  payload: { projects: Array<Record<string, unknown>> },
) {
  return http.post(`/orgs/${orgSlug}/projects/bulk`, payload).then((r) => r.data);
}
```

### 3.2 后端 Controller

**文件**: `apps/server/src/modules/projects/projects.controller.ts` (第 26-71 行)

```typescript
@Post()
@Roles(OrgRole.DEVELOPER)
create(
  @OrgId() orgId: string,
  @Body() body: {
    name: string;
    slug: string;
    frameworkType: string;
    repoFullName: string;
    gitAccountId: string;
    installCommand?: string;
    buildCommand?: string;
    workingDirectory?: string | null;  // ← monorepo 工作目录
    outputDir?: string;
    nodeVersion?: string;
    ssrEntryPoint?: string | null;
    servicePort?: number;
  },
) {
  return this.projects.createProject(orgId, body);
}

@Post('bulk')
@Roles(OrgRole.DEVELOPER)
createBulk(
  @OrgId() orgId: string,
  @Body()
  body: {
    projects: Array<{
      name: string;
      slug: string;
      frameworkType: string;
      repoFullName: string;
      gitAccountId: string;
      installCommand?: string;
      buildCommand?: string;
      workingDirectory?: string | null;
      outputDir?: string;
      nodeVersion?: string;
      ssrEntryPoint?: string | null;
      servicePort?: number;
    }>;
  },
) {
  return this.projects.createProjectsBulk(orgId, body.projects ?? []);
}
```

### 3.3 Shared DTO

**文件**: `packages/shared/src/dto.ts` (第 56-70 行)

```typescript
export const CreateProjectDto = z.object({
  name: z.string().min(1).max(64),
  slug: urlSlugZ,
  frameworkType: z.nativeEnum(FrameworkType),
  repoFullName: z.string().min(1),
  gitProvider: z.nativeEnum(GitProvider),
  accessToken: z.string().min(1),
  gitUsername: z.string().optional(),
});

export const UpdateProjectDto = z.object({
  name: z.string().min(1).max(64).optional(),
  frameworkType: z.nativeEnum(FrameworkType).optional(),
  slug: urlSlugZ.optional(),
});

export const UpdatePipelineConfigDto = z.object({
  installCommand: z.string().optional(),
  buildCommand: z.string().min(1),
  lintCommand: z.string().optional(),
  testCommand: z.string().optional(),
  workingDirectory: z.string().optional(),   // ← 新增
  outputDir: z.string().min(1),
  nodeVersion: z.string().optional(),
  cacheEnabled: z.boolean().optional(),
  timeoutSeconds: z.number().int().min(60).max(3600).optional(),
  ssrEntryPoint: z.string().optional(),
  servicePort: z.number().int().min(1).max(65535).optional(),
});
```

---

## 4. 框架类型与构建行为的对应关系

### 4.1 框架检测与运行时决策

**文件**: `apps/server/src/modules/pipeline/node-runtime-bundle.ts`

```typescript
export function usesPm2RuntimeFramework(frameworkType: string): boolean {
  return frameworkType !== 'static';  // SSR 和 NODEJS 都需要运行时
}
```

**运行时行为**：
- `static` → 打包静态文件，直接上传至 Web 服务器
- `ssr` / `nodejs` → 需要 Node.js 运行时，由 PM2 托管进程

### 4.2 构建过程与产物处理

**文件**: `apps/server/src/modules/pipeline/build-worker.service.ts`

**关键流程**（第 330-369 行）：

```typescript
// build
const [buildBin, ...buildArgs] = pipelineConfig.buildCommand.split(' ');
await this.appendLog(deploymentId, logSeq++, '[build] 开始构建…');
await runCmd(buildBin!, buildArgs, workingDirAbs, 'build');

// ← workingDirAbs 已通过 workingDirectory 计算（第 144 行）
// 若 workingDirectory 不为空，则在子目录内执行构建

// 打包产物
const outputDir = path.resolve(workingDirAbs, pipelineConfig.outputDir);
// ...

// 运行时 Bundle（仅 SSR/NODEJS）
if (usesPm2RuntimeFramework(project.frameworkType)) {
  runtimeBundleDir = await this.prepareNodeRuntimeBundle({
    deploymentId,
    repoRoot: tmpAbs,
    outputDir,
    packageManager: pm,
    useDocker,
    runCmd,
    nextLog: () => logSeq++,
  });
  archiveCwd = runtimeBundleDir;
}

// 打包产物（对于 Node/SSR，包含 node_modules + 启动脚本）
await tar.create({ gzip: true, file: artifactPath, cwd: archiveCwd }, ['.']);
```

### 4.3 默认运行时入口

**文件**: `packages/shared/src/utils.ts` (第 15-33 行)

```typescript
export function defaultRuntimeEntryPoint(frameworkType: string): string | null {
  switch (frameworkType) {
    case FrameworkType.NODEJS:
      return 'dist/main.js';
    case FrameworkType.SSR:
      return 'dist/index.js';
    default:
      return null;  // static 无需
  }
}

export function resolveRuntimeEntryPoint(
  frameworkType: string,
  configuredEntryPoint: string | null | undefined,
): string | null {
  const entry = configuredEntryPoint?.trim();
  return entry ? entry : defaultRuntimeEntryPoint(frameworkType);
}
```

---

## 5. 创建项目的前端表单和逻辑

### 5.1 Web 端新建项目页面

**文件**: `apps/web/src/pages/projects/ProjectNewPage.vue`

三步骤流程：
1. **Step 1: Git 仓库选择** (行 13-115)
   - 选择 Git 账户 → 拉取仓库列表
   - 填写项目名称、URL 标识、框架类型
   - 提供**单应用模式**和**批量模式**切换（行 91）

2. **Step 2: 构建配置** (行 118-251)
   - **单应用模式**（行 120-145）：填写安装命令、构建命令、工作目录、输出目录等
   - **批量模式**（行 146-245）：
     - 环境模板预设（可选，行 154-195）
     - 可复用预设模板"Web + Server"或"Web + NestJS"（行 151-152）
     - 为每个子应用独立配置框架类型、工作目录、构建命令等

### 5.2 项目创建数据结构

**文件**: `apps/web/src/pages/projects/ProjectNewPage.vue` (行 344-410)

```typescript
type ProjectCreateDraft = {
  name: string;
  slug: string;
  frameworkType: string;
  installCommand: string;
  buildCommand: string;
  workingDirectory: string;  // ← 工作目录
  outputDir: string;
  nodeVersion: string;
  ssrEntryPoint: string;
  servicePort: number;
};

// 单应用表单
const form = ref({
  name: '',
  slug: '',
  frameworkType: 'static',
  repoFullName: null as string | null,
  gitAccountId: '',
  installCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  workingDirectory: '',
  outputDir: 'dist',
  nodeVersion: '20',
  ssrEntryPoint: '',
  servicePort: 3000,
});

// 批量模式：多个项目
const batchMode = ref(false);
const batchProjects = ref<ProjectCreateDraft[]>([createDraft(), createDraft()]);
```

### 5.3 预设模板（Preset）

**文件**: `apps/web/src/pages/projects/ProjectNewPage.vue` (行 372-392)

```typescript
function createDraftFromPreset(
  kind: 'static' | 'nodejs',
  name: string,
  workingDirectory: string,
): ProjectCreateDraft {
  const normalizedName = name.trim();
  const isNode = kind === 'nodejs';
  const filterPath = workingDirectory.startsWith('.') ? workingDirectory : `./${workingDirectory}`;
  return {
    name: normalizedName,
    slug: slugifyFromDisplayName(normalizedName),
    frameworkType: kind,
    installCommand: 'pnpm install',
    buildCommand: `pnpm --filter ${filterPath} build`,  // monorepo 多包构建
    workingDirectory,
    outputDir: 'dist',
    nodeVersion: '20',
    ssrEntryPoint: isNode ? 'dist/main.js' : '',
    servicePort: isNode ? 3000 : 3000,
  };
}

// 预设应用
function applyBatchPreset(kind: 'web_server' | 'web_nest') {
  const baseName = form.value.name.trim() || 'Monorepo App';
  const webName = `${baseName} Web`;
  const apiName = kind === 'web_nest' ? `${baseName} Nest API` : `${baseName} Server`;
  batchProjects.value = [
    createDraftFromPreset('static', webName, 'apps/web'),
    createDraftFromPreset('nodejs', apiName, 'apps/server'),
  ];
}
```

---

## 6. Monorepo 子应用与工作目录的实现

### 6.1 工作目录的计算和验证

**文件**: `apps/server/src/modules/pipeline/build-worker.service.ts` (第 140-144 行)

```typescript
const workingDirInput = pipelineConfig.workingDirectory?.trim() ?? '';
if (workingDirInput && !isRelativeSubdir(workingDirInput)) {
  throw new Error('工作目录配置非法：必须是仓库根目录内的相对路径，且不能包含 ..');
}
const workingDirAbs = workingDirInput ? path.resolve(tmpAbs, workingDirInput) : tmpAbs;
```

**文件**: `apps/server/src/modules/pipeline/node-runtime-bundle.ts` (第 8-14 行)

```typescript
export function isRelativeSubdir(input: string): boolean {
  const normalized = input.trim().replace(/\\/g, '/');
  if (!normalized || normalized === '.') return true;
  if (normalized.startsWith('/') || normalized.startsWith('../') || normalized.includes('/../')) {
    return false;
  }
  return normalized !== '..';
}
```

### 6.2 批量创建项目的实现

**文件**: `apps/server/src/modules/projects/application/projects.application.service.ts` (第 121-152 行)

```typescript
async createProjectsBulk(
  orgId: string,
  items: Array<{
    name: string;
    slug: string;
    frameworkType: string;
    repoFullName: string;
    gitAccountId: string;
    installCommand?: string;
    buildCommand?: string;
    workingDirectory?: string | null;
    outputDir?: string;
    nodeVersion?: string;
    ssrEntryPoint?: string | null;
    servicePort?: number;
  }>,
) {
  if (items.length === 0) {
    throw new BadRequestException('projects 不能为空');
  }
  const seen = new Set<string>();
  const created: Array<Awaited<ReturnType<typeof this.createProject>>> = [];
  for (const item of items) {
    const slug = item.slug.trim();
    if (seen.has(slug)) {
      throw new BadRequestException(`批量创建中存在重复 slug：${slug}`);
    }
    seen.add(slug);
    created.push(await this.createProject(orgId, item));
  }
  return created;
}
```

**特点**：
- 顺序创建，若某个失败则中断整个批处理
- 检查重复 slug（同一批次内不允许）
- 每个项目可配置不同的 `workingDirectory`

### 6.3 前端的批量项目环境模板

**文件**: `apps/web/src/pages/projects/ProjectNewPage.vue` (第 450-536 行)

```typescript
async function handleCreate() {
  if (batchMode.value) {
    // ...
    const payload = batchProjects.value.map((item) => ({
      name: item.name.trim(),
      slug: item.slug.trim(),
      frameworkType: item.frameworkType,
      repoFullName: form.value.repoFullName ?? '',
      gitAccountId: form.value.gitAccountId,
      installCommand: item.installCommand.trim() || 'pnpm install',
      buildCommand: item.buildCommand.trim() || 'pnpm build',
      workingDirectory: item.workingDirectory.trim() || null,
      outputDir: item.outputDir.trim() || 'dist',
      nodeVersion: item.nodeVersion,
      ssrEntryPoint: item.frameworkType === 'static' ? null : item.ssrEntryPoint.trim() || null,
      servicePort: item.frameworkType === 'static' ? 3000 : item.servicePort,
    }));
    
    // 调用 createProjectsBulk API
    const created = (await creation.createProjectsBulk({ projects: payload })) as Array<{
      slug: string;
      frameworkType: string;
    }>;
    
    // 若启用环境模板，为每个创建的项目生成默认环境
    if (envTemplate.value.enabled) {
      creatingEnvironments.value = true;
      const deployRoot = trimTrailingSlashes(envTemplate.value.deployRoot.trim());
      const baseDomain = normalizeBaseDomain(envTemplate.value.baseDomain);
      const envName = envTemplate.value.name.trim() || 'production';
      const branch = envTemplate.value.triggerBranch.trim() || 'main';
      const draftBySlug = new Map(batchProjects.value.map((item) => [item.slug.trim(), item]));
      
      const settled = await Promise.allSettled(
        created.map((project) =>
          createEnvironment(orgSlug.value, project.slug, {
            name: envName,
            triggerBranch: branch,
            serverId: envTemplate.value.executor === 'ssh' ? envTemplate.value.serverId : null,
            deployPath: `${deployRoot}/${project.slug}`,
            domain: baseDomain ? `${project.slug}.${baseDomain}` : undefined,
            healthCheckUrl: buildDefaultHealthCheckUrl(draftBySlug.get(project.slug), baseDomain),
            protected: envTemplate.value.protected,
            ...(envTemplate.value.executor === 'local'
              ? { releaseConfig: { executor: 'local', strategy: 'direct' }, environmentTargets: [] }
              : {}),
          }),
        ),
      );
      // ...
    }
    return;
  }
  // 单应用模式...
}
```

**环境模板支持**（行 427-436）：
```typescript
const envTemplate = ref({
  enabled: false,
  name: 'production',
  triggerBranch: 'main',
  executor: 'ssh' as 'ssh' | 'local',
  serverId: null as string | null,
  deployRoot: '/var/www/shipyard',
  baseDomain: '',
  protected: false,
});
```

---

## 7. 框架类型与部署的对应关系总结

| 框架类型 | 构建产物 | 部署方式 | 启动命令 | 端口 | 场景示例 |
|---------|--------|--------|--------|-----|---------|
| `static` | 静态 HTML/JS/CSS | 上传至 Web 目录或 PM2 静态回退 | 无（Web 服务器直接服务） | 无（或 80/443） | Vite SPA、Next.js export、UmiJS |
| `ssr` | Node 应用 + 产物 + dependencies | PM2 + Node.js | `node dist/index.js` 或自定义 | 需要配置 (servicePort) | Next.js、Nuxt、Express SSR |
| `nodejs` | Node 应用 + 产物 + dependencies | PM2 + Node.js | `node dist/main.js` 或自定义 | 需要配置 (servicePort) | NestJS、Express、Fastify、Fastify |

---

## 8. 相关文件查阅快速索引

| 功能 | 文件路径 | 行号 | 说明 |
|-----|--------|-----|-----|
| 框架枚举 | `packages/shared/src/enums.ts` | 25-29 | FrameworkType 定义 |
| DTO 验证 | `packages/shared/src/dto.ts` | 56-85 | CreateProjectDto 和 UpdatePipelineConfigDto |
| 项目表 | `apps/server/prisma/schema.prisma` | 131-164 | Project 模型，包含 frameworkType |
| 构建配置表 | `apps/server/prisma/schema.prisma` | 166-192 | PipelineConfig，包含 workingDirectory |
| Migration | `apps/server/prisma/migrations/20260617154000_pipeline_working_directory/migration.sql` | - | workingDirectory 字段添加 |
| Controller | `apps/server/src/modules/projects/projects.controller.ts` | 26-71 | POST /orgs/:orgSlug/projects 和 /bulk 接口 |
| Service | `apps/server/src/modules/projects/application/projects.application.service.ts` | 43-152 | createProject 和 createProjectsBulk 实现 |
| 构建工作流 | `apps/server/src/modules/pipeline/build-worker.service.ts` | 111-526 | 完整的构建过程（包括 workingDirectory 处理） |
| 运行时判断 | `apps/server/src/modules/pipeline/node-runtime-bundle.ts` | 4-45 | usesPm2RuntimeFramework 等工具函数 |
| 工具函数 | `packages/shared/src/utils.ts` | 15-51 | defaultRuntimeEntryPoint 等 |
| Web 页面 | `apps/web/src/pages/projects/ProjectNewPage.vue` | 1-729 | 完整的前端创建流程，包括批量模式 |
| API 定义 | `apps/web/src/api/projects/index.ts` | 99-108 | createProject 和 createProjectsBulk 函数 |
| Composable | `apps/web/src/composables/projects/useProjectCreationFlow.ts` | 1-56 | 创建流程的 Vue hooks |

---

## 9. 关键提交

**提交**: `6900623901e62b128d17dd5aa31e64da0abb9654`
**提交信息**: `feat(worker): 支持 monorepo 子应用工作目录与批量建项`
**提交时间**: 2026-06-17 16:34:51 +0800

**变更概览**：
- 新增 `PipelineConfig.workingDirectory` 字段
- 新增 `/projects/bulk` 端点和 `createProjectsBulk` 服务方法
- 前端 UI 支持批量创建模式，含预设模板和环境模板
- 构建工作流完整支持子应用工作目录路径解析

---

## 10. 常见 Q&A

**Q: 一个项目可以有多个工作目录吗？**
A: 不可以。一个项目 (Project) 对应一个 PipelineConfig，因此只能有一个 workingDirectory。若需要在 monorepo 中为不同子应用部署，应创建**多个项目**（使用批量创建）。

**Q: 框架类型创建后能改吗？**
A: 可以。UpdateProjectDto 包含 frameworkType 字段，但改动框架类型会影响部署行为（static 无入口文件，SSR/NODEJS 需要）。建议同步修改 ssrEntryPoint。

**Q: workingDirectory 为空和为 "." 是否等价？**
A: 几乎等价，但代码中 `isRelativeSubdir('')` 和 `isRelativeSubdir('.')` 都返回 true。存储时推荐用 null 表示根目录，更清晰。

**Q: 批量创建时，如果一个项目创建失败，其他项目还会创建吗？**
A: 不会。`createProjectsBulk` 使用顺序 for 循环，若 `createProject` 抛异常则中断。这是保守设计，避免仓库被部分注册。

**Q: 同一仓库可以有多个框架类型的项目吗？**
A: 可以。批量创建时，同一 repoFullName 下可以有 static、SSR、NODEJS 混合的项目，各自配置不同的 workingDirectory。

