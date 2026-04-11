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

- **GitHub**：注册 `push` 与 **`pull_request`**（PR 预览）；若远端已有同 URL Hook 但缺少 `pull_request`，保存预览相关设置或重新注册时会 **PATCH 补齐**。
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

**已实现（多平台 MR/PR）**

- **GitHub**：`pull_request`（opened / synchronize / closed 等）；Webhook 注册含 `pull_request`，已存在 Hook 会自动 PATCH 补齐事件。
- **GitLab**：`Merge Request Hook`（`object_kind=merge_request`）；项目 Hook 开启或 PATCH 补齐 `merge_requests_events`。
- **Gitee**：`merge_request_hooks`；创建或 PATCH Hook 时开启 `merge_requests_events`。
- **Gitea**：`pull_request`；仓库 Hook 的 `events` 含 `push` 与 `pull_request`，已存在 Hook 会 PATCH 补齐。
- 上述平台统一行为：同仓库 MR/PR 触发构建与 Linux 预览部署、关闭/合并时清理（含队列 job 取消与远端 teardown 幂等）、**Fork 来源与目标不一致时跳过**。
- 预览 URL：`pr-{prNumber}-{projectId前8位}.{previewBaseDomain}`（项目在控制台配置「预览父域」，例如 `preview.example.com`）。
- **SSR**：Redis 端口池；每 PR 固定 PM2 应用名；每次部署**新占端口**，单次 SSH 内 `pm2 delete`（若存在）后 `pm2 start`，Nginx 指新端口并重载；成功后释放旧端口占用；**部署失败且尚未写入 DB 时会回滚本次新端口的 Redis 占用**（非「双进程并行 + 原子切流」的完整蓝绿）。
- **静态站点**：`releases/<deploymentId>` + `current` 软链，Nginx `root` 指向 `current`。
- **预览评论**（成功/失败同一条更新）：GitHub（issues comments）、GitLab（MR notes）、Gitee（pull comments）、Gitea（PR 走 issues comments API，需配置实例 **baseUrl**）；Token 需具备对应 API 写权限。

**运维需一次性配置**

- DNS：`*.preview.example.com`（与所填父域一致）解析到入口或预览机。
- TLS：若需 HTTPS，多为泛域名证书（如 DNS-01 / acme.sh）；当前自动下发的 Nginx 片段为 **listen 80**，可在片段外统一终止 TLS 或由运维改写。
- Nginx 主配置 `http` 块内增加：`include /etc/nginx/shipyard-previews.d/*.conf;`
- 防火墙：放行 SSR 所用端口区间（默认 40000–41000，可在「服务器」上配置 `previewPortMin` / `previewPortMax`）。

**仍待增强（可选）**

- **完整蓝绿**：例如候选 PM2 进程名、新旧实例并行监听、健康检查通过后再摘旧进程、Nginx 配置原子切换（`rename`/双文件）等，以进一步压缩切换空窗并降低异常时无进程风险。
- **实例兼容**：自托管 GitLab / Gitea / Gitee 版本差异可能导致 Hook PATCH 或评论 REST 路径、字段与公有云文档不一致，部署前请对照各实例官方 Webhook 与 REST API 文档做一次核对。

### 2）通知系统完善（配置 + 触发点）

**已有基础（代码中）**

- 数据表 `Notification`（按 `projectId` 存 `channel`、`config`、`events[]`、`enabled`）；BullMQ 队列 `notify-{orgId}`，由 Worker 进程消费。
- **REST**：`GET/POST/PATCH/DELETE …/orgs/:orgSlug/projects/:projectSlug/notifications`（JWT + 角色：`VIEWER` 可读，`DEVELOPER` 可写）；**管理端**：项目详情 Tab「通知」。
- **事件入队**：构建/部署/审批等路径调用 `NotificationEnqueueApplicationService` 写入队列（如 `attempts: 3`、指数退避）；负载含 `message`、`detailUrl`、`deploymentId`、`projectSlug`、`orgSlug`、`event` 等。
- **出站**：`webhook`（原样 POST JSON payload）、`email`（Nodemailer，SMTP `connectionTimeout` / `socketTimeout` 约 10s）、飞书/钉钉/Slack（机器人 Webhook JSON）。HTTP(S) 出站前经 `assertSafeOutboundHttpUrl`：`dns.lookup`（`all: true`）得到全部解析地址，并结合 `@shipyard/shared` 的 `isBlockedOutboundIp`（IPv4/IPv6 私网与保留段等）。
- **敏感字段**：`config` 内 `secret`、`smtpPass` 等使用 `CryptoService` 加密落库；API 响应脱敏（如 `secretConfigured` / `smtpPassConfigured`）。
- **SSRF 与 URL 主机**：允许配置**字面 IP** 的 `http(s)` URL，对该地址直接做阻断列表校验；若为**域名**，则对该主机名解析得到的**全部**结果逐一校验，任一对私网/保留段即拒绝。
- **IM `secret`**：控制台可填写并加密存储；当前 Worker **未**对飞书/钉钉/Slack 请求做加签（按无密钥 Webhook URL 使用）。若需「密钥 + 签名 URL」需在发送路径另行实现。
- **测试**：根目录 `pnpm test` 会先执行 `pnpm --filter @shipyard/shared build` 再跑各包测试，避免 `@shipyard/server` Vitest 引用过期 `dist` 报错。若 CI 将 job 拆分，运行 server 测试的 job 也须先构建 `@shipyard/shared`。

**仍待增强**

- **运行时新建组织**：Notify Worker 仅在进程启动时为已有组织注册消费者；新建组织后需**重启 worker**，或后续实现动态 `startWorkerForOrg`。
- **IM 加签**：钉钉/飞书等平台的签名 URL / HMAC 与已存储 `secret` 联动。

### 3）构建与部署可靠性加固

- BuildWorker：修复 clone/workdir 流程、日志 flush 策略、缓存策略（按 lockfile hash）
- DeployWorker：完善 SSH/rsync 密钥处理、远端依赖检测（nginx/rsync/acme.sh/pm2/nvm）与失败提示
- 产物清理：按 `Organization.artifactRetention` 自动清理（count-based）
- Docker 构建隔离（Phase 2）：rootless + 资源限制 + seccomp
