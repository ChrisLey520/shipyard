# Shipyard 框架类型与项目创建快速参考

## 框架类型对比

| 特性 | static | ssr | nodejs |
|-----|--------|-----|--------|
| **枚举值** | `'static'` | `'ssr'` | `'nodejs'` |
| **框架示例** | Vite/React SPA、Next.js export、Vue SPA | Next.js、Nuxt、Express+SSR | NestJS、Express、Fastify |
| **需要运行时** | ❌ | ✅ | ✅ |
| **默认启动脚本** | — | `dist/index.js` | `dist/main.js` |
| **默认服务端口** | — | 3000 | 3000 |
| **需要 package.json** | ❌ | ✅ | ✅ |
| **需要 node_modules** | ❌ | ✅ | ✅ |
| **产物包含** | HTML/CSS/JS 静态文件 | 编译输出 + Node app + node_modules | 编译输出 + Node app + node_modules |

## 常见架构示例

### Monorepo 多应用批量创建示例

```
my-monorepo/
├── apps/
│   ├── web/              ← 应用 1：static
│   │   ├── src/
│   │   ├── dist/        ← 输出目录
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── server/           ← 应用 2：nodejs
│   │   ├── src/
│   │   ├── dist/        ← 输出目录
│   │   ├── package.json
│   │   └── nest-cli.json
│   └── docs/             ← 应用 3：static
│       ├── src/
│       └── package.json
├── packages/
│   ├── common/
│   └── ui/
└── pnpm-workspace.yaml
```

**批量创建配置**：

| 项目名 | 框架 | slug | 工作目录 | 构建命令 |
|------|------|------|---------|---------|
| My App Web | static | my-web | `apps/web` | `pnpm --filter ./apps/web build` |
| My App Server | nodejs | my-server | `apps/server` | `pnpm --filter ./apps/server build` |
| My App Docs | static | my-docs | `apps/docs` | `pnpm --filter ./apps/docs build` |

## API 端点速查

### 单个项目创建
```http
POST /orgs/{orgSlug}/projects

Body:
{
  "name": "My Project",
  "slug": "my-project",
  "frameworkType": "static|ssr|nodejs",
  "repoFullName": "owner/repo",
  "gitAccountId": "{id}",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm build",
  "workingDirectory": null,  // or "apps/web"
  "outputDir": "dist",
  "nodeVersion": "20",
  "ssrEntryPoint": null,  // for static
  "servicePort": 3000
}
```

### 批量项目创建
```http
POST /orgs/{orgSlug}/projects/bulk

Body:
{
  "projects": [
    {
      "name": "App 1",
      "slug": "app-1",
      "frameworkType": "static",
      "repoFullName": "owner/repo",
      "gitAccountId": "{id}",
      "workingDirectory": "apps/web",
      ...
    },
    {
      "name": "App 2",
      "slug": "app-2",
      "frameworkType": "nodejs",
      "repoFullName": "owner/repo",
      "gitAccountId": "{id}",
      "workingDirectory": "apps/server",
      ...
    }
  ]
}
```

## 工作目录（workingDirectory）验证规则

✅ **允许**：
- `null` / 空字符串（仓库根目录）
- `apps/web`
- `packages/backend`
- `./apps/web`（前导 ./ 会被保留）
- `api`

❌ **禁止**：
- `/apps/web`（绝对路径，以 / 开头）
- `../apps/web`（相对上级目录）
- `apps/../web`（包含 /..）
- `C:\apps\web`（Windows 绝对路径）

验证函数：`isRelativeSubdir()` 在 `node-runtime-bundle.ts` 中

## 框架类型决策树

```
项目是什么？
│
├─ 纯前端 SPA / 静态网站
│  └─→ frameworkType = "static"
│      - 无需运行时
│      - 产物为 HTML/JS/CSS
│      - 可用静态 Web 服务器或 PM2 回退
│
├─ Node 全栈应用（Next.js、Nuxt）
│  └─→ frameworkType = "ssr"
│      - 需要 Node 运行时
│      - 需要指定启动脚本（默认 dist/index.js）
│      - ssrEntryPoint 自定义启动入口
│
└─ 纯 API 后端（Express、NestJS、Fastify）
   └─→ frameworkType = "nodejs"
       - 需要 Node 运行时
       - 需要指定启动脚本（默认 dist/main.js）
       - ssrEntryPoint 自定义启动入口
```

## Monorepo 工作流

### 场景 1：同仓多应用（无共享构建）

```bash
# 分别为 apps/web 和 apps/server 创建两个项目
Project 1: slug="web"
  - frameworkType: "static"
  - workingDirectory: "apps/web"
  - buildCommand: "pnpm build"

Project 2: slug="server"
  - frameworkType: "nodejs"
  - workingDirectory: "apps/server"
  - buildCommand: "pnpm build"
```

### 场景 2：Monorepo Workspace（使用 pnpm --filter）

```bash
# 使用 pnpm 多包管理构建
Project 1: slug="web"
  - frameworkType: "static"
  - workingDirectory: "apps/web"
  - buildCommand: "pnpm --filter ./apps/web build"  # 仅构建该包的依赖

Project 2: slug="server"
  - frameworkType: "nodejs"
  - workingDirectory: "apps/server"
  - buildCommand: "pnpm --filter ./apps/server build"
```

**pnpm --filter 的优点**：
- 仅安装该子包的依赖，加快构建速度
- 减少产物大小
- 避免子包间的循环依赖问题

## 关键文件速查

```
packages/shared/src/
  ├─ enums.ts ..................... FrameworkType 枚举（行 25-29）
  ├─ dto.ts ....................... DTO 验证规则（行 56-85）
  └─ utils.ts ..................... 工具函数（行 15-51）

apps/server/src/modules/
  ├─ projects/
  │  ├─ projects.controller.ts .... API 路由（行 26-71）
  │  └─ application/projects.application.service.ts
  │                              .... 创建逻辑（行 43-152）
  └─ pipeline/
     ├─ build-worker.service.ts .. 构建流程（行 140-369）
     └─ node-runtime-bundle.ts ... 运行时检测（行 4-14）

apps/web/src/
  ├─ pages/projects/ProjectNewPage.vue
  │                              .... 完整前端流程（行 1-729）
  └─ api/projects/index.ts ........ API 调用（行 99-108）
```

## 常见错误与排查

| 错误 | 原因 | 解决方案 |
|-----|------|--------|
| 构建失败："产物目录不存在" | outputDir 配置错误 | 检查实际构建输出位置，如 `build`、`out` |
| 启动失败："入口文件不存在" | ssrEntryPoint 配置错误或不匹配 frameworkType | 确认 frameworkType 和 ssrEntryPoint 是否配对 |
| 依赖缺失（module not found） | workingDirectory 错误，导致在错误目录找 package.json | 确保 workingDirectory 指向有效子包目录 |
| 批量创建部分失败 | 重复的 slug 或其他验证失败 | 检查每个项目的 slug 唯一性和字段合法性 |
| 静态站点部署无法访问 | 配置了 ssrEntryPoint（不应该） | static 类型忽略 ssrEntryPoint，无需配置 |

