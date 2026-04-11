# Shipyard（前端 CI/CD 自托管平台）

Shipyard 是一个面向多租户、可自托管的前端 CI/CD 平台，用于部署前端项目（静态站点 + SSR）。  
技术栈：后端/Worker 为 **NestJS + Prisma + PostgreSQL + Redis + BullMQ**，前端为 **Vue 3 + Vite + Pinia + Naive UI**。

另见英文版：`README-EN.md`

## Monorepo 目录结构

- `apps/server`：NestJS API Server + Prisma Schema
- `apps/web`：Vue 3 管理后台
- `packages/shared`：前后端共享的 enums/DTOs/utils（仅纯函数，不包含加密逻辑）
- `e2e/`：Playwright 端到端金路径（与 `pnpm test` 中的 Vitest 分离）

## 前置要求

- Node.js（建议 20+）
- pnpm（本仓库使用 **pnpm**，不使用 npm）
- Docker + Docker Compose（用于本地 postgres/redis；也可用来整套跑起来）

## E2E（Playwright）

金路径覆盖：**注册 → 组织列表 → 创建组织 → 登录**。默认 **`pnpm test` 不跑 E2E**，避免拖慢日常提交。

**前置**

1. 启动数据库与 Redis：`docker compose up -d`（需与根目录 `.env` 中 `DATABASE_URL`、`REDIS_URL` 一致）。
2. 应用迁移：`pnpm db:migrate`（或 `pnpm db:migrate:deploy`）。
3. 首次安装浏览器内核：`pnpm exec playwright install chromium`。

**运行**

```bash
pnpm test:e2e
```

本地调试 UI：`pnpm test:e2e:ui`。

Playwright 会拉起 **Nest `dev`（3000）** 与 **Vite `dev`（5173，`127.0.0.1`）**。非 CI 时若本机已在相同端口跑好服务，会 **复用已有进程**（`reuseExistingServer`）。若一键启动异常（尤其在 Windows 上），可手动执行 `pnpm dev:server` 与 `pnpm dev:web` 后再跑 `pnpm test:e2e`。

**说明**：CI 流水线接入 E2E 需自备 Docker 服务与 `playwright install`；当前仓库未强制配置，可自行在 GitHub Actions 等环境中增加 job。

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

## Git 集成（Webhook、OAuth、Commit Status）

支持 **GitHub / GitLab / Gitee / Gitea**。关联账户可用 **PAT** 或 **OAuth**（Git 账户页「OAuth 授权」；需配置 `.env` 中 `GIT_OAUTH_*`，见 `.env.example`）。

### Webhook（推送自动构建）

- 在 Shipyard **创建项目** 且已配置 **`SERVER_PUBLIC_URL`** 时，会尝试在远端仓库 **自动注册** Webhook；删除项目时 **自动注销**。
- 回调地址形如：`{SERVER_PUBLIC_URL}/api/webhooks/{github|gitlab|gitee|gitea}?p=<Project.id>`，其中 **`p` 为项目 UUID**，用于同仓多项目路由，请勿手动改成无 `p` 的 URL。
- **`SERVER_PUBLIC_URL` 必须是 Git 平台能访问到的 API 根地址**（含协议与端口），与前端 `APP_URL`（如 `http://localhost:5173`）通常不同。
- **从旧版升级**：若远端仍保留 **无 `?p=`** 的 Webhook，请在各平台删除旧 Hook 后，通过重新创建项目或触发重新注册，使回调带 `p=<Project.id>`。

### GitHub OAuth App 配置要点

- **Authorization callback URL** 须与后端实际发出的 `redirect_uri` 完全一致，例如：
  - 本地 API：`http://localhost:3000/api/git/oauth/github/callback`
  - 或使用 ngrok 等：**`https://<你的域名>/api/git/oauth/github/callback`**（与 `SERVER_PUBLIC_URL` 一致）
- **不要**只填 `http://localhost:5173`：OAuth 回调由 **Nest API** 处理，不是 Vite 开发服务器。
- **Homepage URL** 可填产品首页（如 `http://localhost:5173`），仅作展示，不参与 redirect 校验。

### 数据库

引入 `GitAccount` OAuth 字段、`GitConnection.gitAccountId` 等需执行迁移：

```bash
pnpm --filter @shipyard/server db:migrate
```

### Commit Status

构建与部署关键状态会回写到各平台（`shipyard/build`、`shipyard/deploy`），依赖 `APP_URL` 生成部署详情链接。

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
- **Git 多平台**：Webhook 接收（`p` 路由、验签、幂等、Webhook 触发的入队去重）、项目创建/删除时自动注册或注销 Hook、Commit Status 回写、Git 账户 **PAT + OAuth**（详见上文「Git 集成」）

## 下一阶段规划（Roadmap / Next Phase）

以下为**尚未实现或持续增强**的方向（按“能跑通 → 可用 → 可运营”排序）。

### 1）PR Preview（预览部署）

- PR opened/synchronize/closed 事件触发构建与清理
- 预览 URL 生成：`pr-{prNumber}-{projectId前8位}.preview.<domain>`
- SSR 端口池分配与回收（并发安全）
- Nginx include 片段生成与 reload（动态路由）
- PR 评论创建/更新（记录 `Preview.commentId`，避免重复评论）
- 蓝绿切换（SSR：PM2 进程 + Nginx 切流；静态：目录切换）

### 2）通知系统完善（配置 + 触发点）

- **通知配置 CRUD**（按 Project）：Webhook / Email（Nodemailer）/ IM（飞书/钉钉/Slack）
- **事件触发点完善**：构建/部署成功失败、审批待处理/通过/拒绝
- SSRF 防护升级：IPv4/IPv6 全覆盖 + 多 A/AAAA 解析校验

### 3）构建与部署可靠性加固

- BuildWorker：修复 clone/workdir 流程、日志 flush 策略、缓存策略（按 lockfile hash）
- DeployWorker：完善 SSH/rsync 密钥处理、远端依赖检测（nginx/rsync/acme.sh/pm2/nvm）与失败提示
- 产物清理：按 `Organization.artifactRetention` 自动清理（count-based）
- Docker 构建隔离（Phase 2）：rootless + 资源限制 + seccomp
