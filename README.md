# Shipyard（前端 CI/CD 自托管平台）

Shipyard 是一个面向多租户、可自托管的前端 CI/CD 平台，用于部署前端项目（静态站点 + SSR）。  
技术栈：后端/Worker 为 **NestJS + Prisma + PostgreSQL + Redis + BullMQ**，前端为 **Vue 3 + Vite + Pinia + Naive UI**。

另见英文版：`README-EN.md`

## Monorepo 目录结构

- `apps/server`：NestJS API Server + Prisma Schema
- `apps/web`：Vue 3 管理后台
- `packages/shared`：前后端共享的 enums/DTOs/utils（仅纯函数，不包含加密逻辑）

## 前置要求

- Node.js（建议 20+）
- pnpm（本仓库使用 **pnpm**，不使用 npm）
- Docker + Docker Compose（用于本地 postgres/redis；也可用来整套跑起来）

## 环境变量

将 `.env.example` 复制为 `.env` 并按需修改：

```bash
cp .env.example .env
```

常用变量说明：

- `DATABASE_URL`：PostgreSQL 连接串
- `REDIS_URL`：Redis 连接串
- `JWT_SECRET`：JWT 签名密钥（生产必须更换）
- `ENCRYPTION_KEY`：AES-256-GCM 主密钥（生产必须更换）
- `APP_URL`：Web 管理后台 URL（邮件链接、**Commit Status 的 target_url** 跳转部署详情）
- `SERVER_PUBLIC_URL`：API 公网根地址（**Webhook 注册**与 **OAuth `redirect_uri`**，须可被 Git 平台访问）
- `API_PUBLIC_URL`（可选）：与 `SERVER_PUBLIC_URL` 不一致时的 OAuth 回调基址
- **Git OAuth**（可选）：`GIT_OAUTH_*` 系列，见根目录 `.env.example`
- `ARTIFACT_STORE_PATH`：构建产物目录

## 本地开发（推荐）

### 1）启动 postgres/redis

```bash
docker compose up -d postgres redis
```

### 2）安装依赖

```bash
pnpm install
```

如果 pnpm 提示忽略了某些依赖的 build scripts，可按需批准并重建：

```bash
pnpm approve-builds
pnpm rebuild
```

### 3）Prisma（生成 client + 迁移）

```bash
pnpm --filter @shipyard/server db:generate
pnpm --filter @shipyard/server db:migrate
```

### 4）启动开发服务

分别在不同终端启动：

```bash
pnpm dev:server
pnpm dev:worker
pnpm dev:web
```

访问地址：

- Web UI：`http://localhost:5173`
- API（Swagger）：`http://localhost:3000/api/docs`

## 常用脚本（根目录）

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r build
```

## 当前已实现功能（按代码现状）

- **认证**：注册/登录、JWT access/refresh、忘记/重置密码
- **多租户组织**：组织列表/创建、成员邀请/移除、RBAC
- **项目**：项目 CRUD、Pipeline 配置、GitConnection（PAT/OAuth token 加密存储、`gitAccountId` 关联）
- **构建流水线**：BullMQ 按组织队列、`child_process` 构建隔离、产物 `.tar.gz`、Redis Pub/Sub + Socket.io 日志推流
- **部署**：SSH 部署（rsync + nginx/pm2 逻辑）、部署锁、健康检查 + 自动回滚
- **审批**：受保护环境审批列表 + 通过/拒绝（通过后入 DeployQueue）
- **Web UI**：登录/注册、Dashboard、项目/环境/服务器/团队/审批、部署日志（xterm）

## 下一阶段规划（Roadmap / Next Phase）

以下为**下一阶段**优先落地的功能特性（按“能跑通 → 可用 → 可运营”排序），用于对齐计划书与代码现状。

### 1）Git 集成增强（多平台 + 自动化）— 已落地要点

- **Webhook 路由（H1）**：回调 URL 必须带查询参数 `p=<Project.id>`（UUID）；接收端按 `p` 加载项目与 `GitConnection`，验签后再校验仓库路径，避免同仓多项目串单。
- **Webhook 去重（H2）**：`PipelineService.enqueueBuild` 在 **无 `triggeredByUserId`（Webhook）** 时，对 `(projectId, environmentId, commitSha)` 若已有 `queued` / `building` / `pending_approval` 则不再新建部署；手动触发始终新建。
- **HTTP 语义**：缺/非法 `p` → **400**；无项目/连接 → **404**；验签失败 → **401**；仓库与项目不一致 → **422**；幂等命中、非 push 事件、无匹配分支 → **200** + 约定 JSON。
- **Raw Body**：`main.ts` 启用 Nest `rawBody`，保证 HMAC 验签与平台一致。
- **自动注册/注销**：GitHub / GitLab / Gitee / Gitea 在项目创建/删除时注册或注销 Webhook（依赖 `SERVER_PUBLIC_URL`）；注册前 **list hooks**，按 URL 含 `?p=` 去重。
- **Commit Status**：`shipyard/build` 与 `shipyard/deploy` 上下文回写至各平台（构建/部署关键状态变更）。
- **OAuth**：`GET /api/orgs/:orgSlug/git/oauth/:provider/start` 返回授权 URL；`GET /api/git/oauth/:provider/callback` 完成授权并写入 `GitAccount`（`authType=oauth`，token/refresh 加密）；GitHub/GitLab 支持 refresh；前端 Git 账户页提供 OAuth 入口。

**升级提示**：旧环境若 Webhook URL **无 `p`**，需在 Git 平台删除旧 Hook 后，通过重新创建项目或等价流程触发带 `?p=` 的重新注册。

### 2）PR Preview（预览部署）

- PR opened/synchronize/closed 事件触发构建与清理
- 预览 URL 生成：`pr-{prNumber}-{projectId前8位}.preview.<domain>`
- SSR 端口池分配与回收（并发安全）
- Nginx include 片段生成与 reload（动态路由）
- PR 评论创建/更新（记录 `Preview.commentId`，避免重复评论）
- 蓝绿切换（SSR：PM2 进程 + Nginx 切流；静态：目录切换）

### 3）通知系统完善（配置 + 触发点）

- **通知配置 CRUD**（按 Project）：Webhook / Email（Nodemailer）/ IM（飞书/钉钉/Slack）
- **事件触发点完善**：构建/部署成功失败、审批待处理/通过/拒绝
- SSRF 防护升级：IPv4/IPv6 全覆盖 + 多 A/AAAA 解析校验

### 4）构建与部署可靠性加固

- BuildWorker：修复 clone/workdir 流程、日志 flush 策略、缓存策略（按 lockfile hash）
- DeployWorker：完善 SSH/rsync 密钥处理、远端依赖检测（nginx/rsync/acme.sh/pm2/nvm）与失败提示
- 产物清理：按 `Organization.artifactRetention` 自动清理（count-based）
- Docker 构建隔离（Phase 2）：rootless + 资源限制 + seccomp
