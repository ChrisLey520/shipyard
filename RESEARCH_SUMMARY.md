# 📋 Shipyard 框架类型与 Monorepo 工作目录完整调研总结

## 🎯 研究成果

您已获得关于 Shipyard 项目新建框架类型、单项目多子应用工作目录、以及批量建项功能的完整文档。以下是核心发现：

---

## 1️⃣ 框架类型枚举 (3 种)

**定义位置**: `packages/shared/src/enums.ts:25-29`

```typescript
export enum FrameworkType {
  STATIC = 'static',      // 静态站点（无运行时）
  SSR = 'ssr',            // 服务端渲染（需 Node 运行时）
  NODEJS = 'nodejs',      // Node 后端服务（需 Node 运行时）
}
```

**行为差异**：

| 类型 | 场景 | 构建产物 | 运行方式 | 默认入口 |
|-----|------|--------|--------|---------|
| `static` | React/Vue SPA、Next.js export、UmiJS | 纯静态文件 | 静态 Web 服务器 | ❌ 无 |
| `ssr` | Next.js、Nuxt、Express SSR | 应用包 + node_modules | PM2 + Node | `dist/index.js` |
| `nodejs` | NestJS、Express、Fastify | 应用包 + node_modules | PM2 + Node | `dist/main.js` |

---

## 2️⃣ 工作目录 (Monorepo 支持)

**新增字段**: `PipelineConfig.workingDirectory` (提交 `6900623`)

**位置**:
- 数据库定义: `apps/server/prisma/schema.prisma:174`
- Migration: `apps/server/prisma/migrations/20260617154000_pipeline_working_directory/migration.sql`

**用途**: 支持 monorepo 中多个独立应用，每个项目可指定不同的工作目录

**验证规则** (在 `node-runtime-bundle.ts:8-14`):

```
✅ 允许:
  - null / ""          (仓库根目录)
  - "apps/web"
  - "packages/backend"
  - "./apps/web"

❌ 禁止:
  - "/apps/web"        (绝对路径)
  - "../apps/web"      (父目录)
  - "apps/../web"      (包含 /..)
  - "C:\path"          (Windows 路径)
```

**构建流程中的应用** (`build-worker.service.ts:140-144`):

```typescript
const workingDirInput = pipelineConfig.workingDirectory?.trim() ?? '';
const workingDirAbs = workingDirInput ? path.resolve(tmpAbs, workingDirInput) : tmpAbs;
// 在 workingDirAbs 目录执行: install → lint → test → build
```

---

## 3️⃣ 批量建项功能

**API 端点**:
- 单个: `POST /orgs/{orgSlug}/projects` (行 26-46)
- 批量: `POST /orgs/{orgSlug}/projects/bulk` (行 48-71)

**文件**:
- Controller: `apps/server/src/modules/projects/projects.controller.ts:48-71`
- Service: `apps/server/src/modules/projects/application/projects.application.service.ts:121-152`
- Web UI: `apps/web/src/pages/projects/ProjectNewPage.vue:146-245` (批量模式)

**批量创建的特点**:
- 顺序创建，一个失败则全部中止
- 检查 slug 重复（同批次内唯一）
- 支持预设模板（"Web + Server"、"Web + NestJS"）
- 支持为批量项目创建统一环境模板

**前端 UI 流程** (ProjectNewPage.vue):

```
Step 1: 选择 Git 仓库
  ├─ 选择 Git 账户
  ├─ 填写项目名称、slug、框架类型
  └─ 勾选「同仓多应用批量创建」→ 切换模式

Step 2: 构建配置
  ├─ [单应用模式]
  │  └─ 填写安装、构建、工作目录等
  └─ [批量模式]
     ├─ 环境模板（可选，为所有项目创建默认环境）
     ├─ 预设模板（快速生成 Web + Server 配置）
     └─ 逐个配置每个子应用的框架类型、工作目录、命令等

Step 3: 创建
  ├─ 调用 createProjectsBulk() API
  ├─ 若启用环境模板，并行创建各项目的默认环境
  └─ 重定向到项目列表
```

---

## 4️⃣ 框架类型与部署对应关系

**运行时判断** (`node-runtime-bundle.ts:4-6`):

```typescript
export function usesPm2RuntimeFramework(frameworkType: string): boolean {
  return frameworkType !== 'static';  // ssr 和 nodejs 都需要运行时
}
```

**构建产物处理** (`build-worker.service.ts:330-369`):

```
若 frameworkType === 'static'
  → 打包静态文件到 tar.gz
  → 部署时上传至 Web 服务器

若 frameworkType === 'ssr' 或 'nodejs'
  → prepareNodeRuntimeBundle()
    ├─ 找到 package.json 根目录
    ├─ 复制 node_modules
    ├─ 准备 package.json 和启动脚本
  → 打包整个运行时目录到 tar.gz
  → 部署时启动 PM2 进程
```

**默认启动入口** (`utils.ts:15-33`):

```typescript
function defaultRuntimeEntryPoint(frameworkType: string): string | null {
  switch (frameworkType) {
    case FrameworkType.NODEJS:
      return 'dist/main.js';
    case FrameworkType.SSR:
      return 'dist/index.js';
    default:
      return null;  // static
  }
}
```

---

## 5️⃣ 实际使用场景示例

### 场景：Monorepo 同步部署多个应用

**仓库结构**:
```
my-monorepo/
├── apps/
│   ├── web/       (Vue 3 Vite SPA)
│   ├── server/    (NestJS 后端)
│   └── docs/      (VitePress 文档)
├── packages/
│   ├── common/    (共享库)
│   └── ui/        (UI 组件库)
└── pnpm-workspace.yaml
```

**批量创建配置**:

```json
{
  "projects": [
    {
      "name": "Web Frontend",
      "slug": "web",
      "frameworkType": "static",
      "repoFullName": "owner/my-monorepo",
      "gitAccountId": "...",
      "workingDirectory": "apps/web",
      "buildCommand": "pnpm --filter ./apps/web build",
      "outputDir": "dist",
      "nodeVersion": "20"
    },
    {
      "name": "API Server",
      "slug": "server",
      "frameworkType": "nodejs",
      "repoFullName": "owner/my-monorepo",
      "gitAccountId": "...",
      "workingDirectory": "apps/server",
      "buildCommand": "pnpm --filter ./apps/server build",
      "outputDir": "dist",
      "nodeVersion": "20",
      "ssrEntryPoint": "dist/main.js",
      "servicePort": 3000
    },
    {
      "name": "Documentation",
      "slug": "docs",
      "frameworkType": "static",
      "repoFullName": "owner/my-monorepo",
      "gitAccountId": "...",
      "workingDirectory": "apps/docs",
      "buildCommand": "pnpm --filter ./apps/docs build",
      "outputDir": ".vitepress/dist"
    }
  ]
}
```

**前端批量环境模板配置**:

```javascript
{
  enabled: true,
  name: "production",
  triggerBranch: "main",
  executor: "ssh",
  serverId: "{server_id}",
  deployRoot: "/var/www/shipyard",
  baseDomain: "apps.example.com",
  protected: true
}
```

**结果**:
- 3 个项目被创建：`web`、`server`、`docs`
- 为每个项目自动创建 `production` 环境
- 部署路径分别为：
  - `/var/www/shipyard/web`
  - `/var/www/shipyard/server`
  - `/var/www/shipyard/docs`
- 访问域名分别为：
  - `web.apps.example.com`
  - `server.apps.example.com`
  - `docs.apps.example.com`

---

## 📂 文档导航

已为您生成两份文档：

### 📖 完整指南 (19KB)
**文件**: `FRAMEWORK_AND_MONOREPO_GUIDE.md`

包含：
- 框架类型枚举及含义表
- 数据模型定义（Project、PipelineConfig）
- API 和 DTO 定义
- 框架类型与构建行为对应关系（4 个子章节）
- 前端表单及创建逻辑（3 个子章节）
- Monorepo 工作目录的完整实现（3 个子章节）
- 快速索引表（18 行文件及行号）
- 常见 Q&A（6 个问答）

### 🚀 快速参考 (6.4KB)
**文件**: `QUICK_REFERENCE.md`

包含：
- 框架类型对比表
- Monorepo 多应用示例
- API 端点速查（HTTP 请求格式）
- 工作目录验证规则
- 框架类型决策树
- Monorepo 工作流（两个场景）
- 关键文件速查
- 常见错误与排查表

---

## 🔍 源码追踪速查表

| 功能 | 文件 | 行号 | 关键字段 |
|-----|------|-----|---------|
| 框架枚举 | `packages/shared/src/enums.ts` | 25-29 | `FrameworkType` |
| 项目创建 DTO | `packages/shared/src/dto.ts` | 56-64 | `CreateProjectDto` |
| 工作目录 DTO | `packages/shared/src/dto.ts` | 73-85 | `UpdatePipelineConfigDto` |
| Project 表 | `apps/server/prisma/schema.prisma` | 131-164 | `frameworkType` |
| PipelineConfig 表 | `apps/server/prisma/schema.prisma` | 166-192 | `workingDirectory` |
| 工作目录 Migration | `apps/server/prisma/migrations/20260617154000_*` | - | `ADD COLUMN workingDirectory` |
| 单项创建接口 | `apps/server/src/modules/projects/projects.controller.ts` | 26-46 | `@Post()` |
| 批量创建接口 | `apps/server/src/modules/projects/projects.controller.ts` | 48-71 | `@Post('bulk')` |
| 单项创建逻辑 | `apps/server/src/modules/projects/application/projects.application.service.ts` | 43-119 | `createProject()` |
| 批量创建逻辑 | `apps/server/src/modules/projects/application/projects.application.service.ts` | 121-152 | `createProjectsBulk()` |
| 工作目录验证 | `apps/server/src/modules/pipeline/node-runtime-bundle.ts` | 8-14 | `isRelativeSubdir()` |
| 运行时检测 | `apps/server/src/modules/pipeline/node-runtime-bundle.ts` | 4-6 | `usesPm2RuntimeFramework()` |
| 构建工作流 | `apps/server/src/modules/pipeline/build-worker.service.ts` | 140-369 | 完整构建过程 |
| 工具函数 | `packages/shared/src/utils.ts` | 15-51 | `defaultRuntimeEntryPoint()` |
| 前端创建页面 | `apps/web/src/pages/projects/ProjectNewPage.vue` | 1-729 | 完整 UI 流程 |
| 前端 API 调用 | `apps/web/src/api/projects/index.ts` | 99-108 | `createProject()`, `createProjectsBulk()` |
| 前端 Hooks | `apps/web/src/composables/projects/useProjectCreationFlow.ts` | 1-56 | `useProjectCreationFlow()` |

---

## 🎓 关键技术点总结

### 1. 框架类型的三分体系
- **static**: 无运行时，产物为纯静态文件
- **ssr**: 有运行时，需要启动 Node 应用，默认启动脚本 `dist/index.js`
- **nodejs**: 有运行时，需要启动 Node 应用，默认启动脚本 `dist/main.js`

### 2. 工作目录的设计
- **目的**: 支持 monorepo 中每个子应用有自己的构建配置
- **存储**: 在 `PipelineConfig.workingDirectory` 中，相对仓库根的相对路径
- **应用**: 构建时在该目录执行命令，产物路径也相对于该目录

### 3. 批量创建的意义
- **一次配置多个项目**: 同一仓库中的多个应用可一次创建
- **环境模板**: 创建后可自动为所有项目生成统一的默认环境
- **预设模板**: 快速应用常见的 Web + Backend 组合

### 4. 构建流程中的框架检测
```
编译构建 ✓ (通用)
  ↓
框架类型检测 (usesPm2RuntimeFramework)
  ├─ static    → 打包静态产物
  └─ ssr/node  → prepareNodeRuntimeBundle → 打包运行时
```

---

## 🔐 验证和约束

| 约束项 | 规则 | 来源 |
|------|------|------|
| 工作目录 | 必须是相对路径，不能包含 `..` | `isRelativeSubdir()` |
| 项目 slug | 同一组织内唯一，仅小写字母/数字/连字符 | `URL_SLUG_PATTERN` |
| 批量重复检查 | 同一批次内 slug 不能重复 | `createProjectsBulk()` line 145 |
| 端口范围 | 1-65535，仅 ssr/nodejs 有效 | `projects.controller.ts` line 69-72 |
| 项目名 | 1-64 字符 | `CreateProjectDto` |

---

## 📌 关键提交

**提交**: `6900623901e62b128d17dd5aa31e64da0abb9654`
**消息**: `feat(worker): 支持 monorepo 子应用工作目录与批量建项`
**时间**: 2026-06-17 16:34:51 +0800
**变更**: 21 个文件，341 行新增

**核心变更**:
1. 添加 `PipelineConfig.workingDirectory` 字段
2. 添加 `/projects/bulk` 端点
3. 实现 `createProjectsBulk()` 服务方法
4. 前端 UI 支持批量模式 + 预设模板 + 环境模板

---

## ✅ 质量检查

- [x] 框架枚举定义已定位并说明（3 种类型）
- [x] 工作目录字段已定位并说明（MongoDB 迁移 + 服务层验证）
- [x] 创建项目的 API 已定位（单个 + 批量）
- [x] 前端表单组件已定位（ProjectNewPage.vue + ProjectCreationFlow）
- [x] 构建流程中的应用已说明（build-worker.service.ts）
- [x] Monorepo 子应用逻辑已说明（工作目录计算 + 验证）
- [x] 批量建项逻辑已说明（循环创建 + 重复检查 + 环境模板）
- [x] 所有文件路径和行号已验证
- [x] 关键代码片段已引用

---

## 🎁 额外资源

已生成可直接使用的文档：

1. **FRAMEWORK_AND_MONOREPO_GUIDE.md** - 完整技术文档（19KB，10 章节）
2. **QUICK_REFERENCE.md** - 快速参考（6.4KB，8 章节）

两份文档都保存在仓库根目录，可在 IDE 中快速查阅。

