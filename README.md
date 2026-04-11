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
- **构建依赖缓存**：`SHIPYARD_BUILD_DEPS_CACHE_PATH`、全局上限、`SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS`（TTL）、`SHIPYARD_BUILD_DEPS_CACHE_ORG_MAX_MB`（单组织上限）等（见 `.env.example`）
- **Docker 构建**：`SHIPYARD_BUILD_USE_DOCKER`、`SHIPYARD_BUILD_DOCKER_IMAGE`，以及可选 `SHIPYARD_BUILD_DOCKER_NETWORK` / `_CPUS` / `_MEMORY` / `_PRIVILEGED`（仅 Linux Worker，详见「Docker 构建支持矩阵」与下文运维说明）

## 运维与 nvm（SSH 部署目标机）

Shipyard 通过 SSH 在远端执行 `[precheck]` 与部署命令时，默认多为 **非登录、非交互 shell**，不会自动执行 `~/.bashrc` 里由 nvm 写入的 `PATH`。

- **不要求**在目标机安装 nvm；若使用 nvm，请保证 **`node` 在 Shipyard 实际用到的 shell 的 PATH 中**（例如将 nvm 初始化写入 `~/.bash_profile` / `~/.profile`，或安装系统级 Node）。
- **自测**：在目标机执行 `bash -lc 'command -v node && node -v'`，结果应与 Shipyard 预检期望一致。

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
- **SSR（蓝绿）**：Redis 端口池；**双槽位** PM2 名 `…-bg0` / `…-bg1` 交替；新部署先起**候选**进程与健康检查（远端 `curl` 本机新端口），**Nginx 片段先写临时文件再 `mv` 原子切换**并重载，再摘除旧槽位/遗留名单进程名；成功后释放旧端口；失败时回滚 Redis 新端口占用，健康检查或 Nginx 失败时尽量恢复旧片段并删除候选 PM2。
- **静态站点**：`releases/<deploymentId>` + `current` 软链，Nginx `root` 指向 `current`。
- **预览评论**（成功/失败同一条更新）：GitHub（issues comments）、GitLab（MR notes）、Gitee（pull comments）、Gitea（PR 走 issues comments API，需配置实例 **baseUrl**）；Token 需具备对应 API 写权限。

**运维需一次性配置**

- DNS：`*.preview.example.com`（与所填父域一致）解析到入口或预览机。
- TLS：若需 HTTPS，多为泛域名证书（如 DNS-01 / acme.sh）；当前自动下发的 Nginx 片段为 **listen 80**，可在片段外统一终止 TLS 或由运维改写。
- Nginx 主配置 `http` 块内增加：`include /etc/nginx/shipyard-previews.d/*.conf;`
- 防火墙：放行 SSR 所用端口区间（默认 40000–41000，可在「服务器」上配置 `previewPortMin` / `previewPortMax`）。

**仍待增强（可选）**

- **实例兼容**：自托管 GitLab / Gitea / Gitee 版本差异可能导致 Hook PATCH 或评论 REST 路径、字段与公有云文档不一致，部署前请对照各实例官方 Webhook 与 REST API 文档做一次核对（可在下方矩阵中补充你的实例版本与结论）。

### 2）通知系统完善（配置 + 触发点）

**已有基础（代码中）**

- 数据表 `Notification`（按 `projectId` 存 `channel`、`config`、`events[]`、`enabled`）；BullMQ 队列 `notify-{orgId}`，由 Worker 进程消费。
- **REST**：`GET/POST/PATCH/DELETE …/orgs/:orgSlug/projects/:projectSlug/notifications`（JWT + 角色：`VIEWER` 可读，`DEVELOPER` 可写）；**管理端**：项目详情 Tab「通知」。
- **事件入队**：构建/部署/审批等路径调用 `NotificationEnqueueApplicationService` 写入队列（如 `attempts: 3`、指数退避）；负载含 `message`、`detailUrl`、`deploymentId`、`projectSlug`、`orgSlug`、`event` 等。
- **出站**：`webhook`（原样 POST JSON payload）、`email`（Nodemailer，SMTP `connectionTimeout` / `socketTimeout` 约 10s）、飞书/钉钉/Slack/**企业微信**（机器人 Webhook JSON；企业微信为 `markdown` 载荷）。HTTP(S) 出站前经 `assertSafeOutboundHttpUrl`：`dns.lookup`（`all: true`）得到全部解析地址，并结合 `@shipyard/shared` 的 `isBlockedOutboundIp`（IPv4/IPv6 私网与保留段等）。入队前 **`message` 支持占位符** `{{projectSlug}}`、`{{orgSlug}}`、`{{event}}`、`{{detailUrl}}`、`{{deploymentId}}`、`{{approvalId}}`（未设置的变量保留原文）。
- **敏感字段**：`config` 内 `secret`、`smtpPass` 等使用 `CryptoService` 加密落库；API 响应脱敏（如 `secretConfigured` / `smtpPassConfigured`）。
- **SSRF 与 URL 主机**：允许配置**字面 IP** 的 `http(s)` URL，对该地址直接做阻断列表校验；若为**域名**，则对该主机名解析得到的**全部**结果逐一校验，任一对私网/保留段即拒绝。
- **IM `secret`**：`secret` 加密存储；**钉钉**为毫秒时间戳 + HMAC 加签 query；**飞书**为秒时间戳 + 同结构加签 query（见 `buildFeishuSignedWebhookUrl`）；**Slack** 原生 Webhook 以 URL 为凭据，可选 `secret` 会作为 `Authorization: Bearer` 发出，便于你在网关侧校验（Slack 公网端点一般忽略该头）。
- **新建组织与 Worker**：创建组织后向 Redis 发布 `worker:new-org`；Build / Deploy / Notify Worker 均已订阅并为新组织注册对应 BullMQ 队列，**一般无需重启** Worker 进程。
- **产物保留**：构建成功后按 `Organization.artifactRetention` 对该组织下全部 `BuildArtifact` 与 `ARTIFACT_STORE_PATH` 内 `*.tar.gz` 做 **count-based** 清理，保留最近 N 条。
- **测试**：根目录 `pnpm test` 会先执行 `pnpm --filter @shipyard/shared build` 再跑各包测试，避免 `@shipyard/server` Vitest 引用过期 `dist` 报错。若 CI 将 job 拆分，运行 server 测试的 job 也须先构建 `@shipyard/shared`。GitHub Actions 见 `.github/workflows/ci.yml`（含可选 E2E）。

**仍待增强**

- 通知渠道与事件矩阵可继续扩充（通用模板、签名校验等）。

### 3）构建与部署可靠性加固

- **BuildWorker**：按 **组织 + 包管理器 + lockfile 内容 SHA256 前缀 + Node 主版本（及可选 `.nvmrc`）** 维护可复用的 `node_modules` 缓存（`cache_hit` / `cache_miss` 日志）；缓存根目录 `SHIPYARD_BUILD_DEPS_CACHE_PATH`（默认系统临时目录下 `shipyard-build-deps-cache`）；总占用上限 `SHIPYARD_BUILD_DEPS_CACHE_MAX_BYTES` 或 `SHIPYARD_BUILD_DEPS_CACHE_MAX_MB`（默认约 5GiB），超出后按指纹目录 **LRU（mtime）** 淘汰。构建 workdir 仍为每次 `build-<deploymentId>`，结束后 `finally` 清理。
- **Docker 构建（opt-in）**：`SHIPYARD_BUILD_USE_DOCKER=true` 且 **Worker 为 Linux** 时，install / lint / test / build 在 **`docker run`** 容器内执行（工作目录挂载到容器 `/workspace`）；镜像 `SHIPYARD_BUILD_DOCKER_IMAGE`（默认 `node:20-bookworm`）。**git clone 仍在宿主**执行。宿主机需可用 `docker` CLI 与镜像拉取权限。非 Linux 平台开启该开关时 **记录告警并回退本机 child_process**。
- **DeployWorker**：SSH 连通后 **`[precheck]`**（Linux：`bash`/`rsync`/按条件 `nginx` 与 SSR 时 `node`+`pm2`；macOS 至少 `bash`/`rsync`，SSR 时检查 `pm2`/`node`）。若缺少 `node`，日志中会提示检查 **login shell、PATH、nvm**（不强制安装 nvm）。**SSR 预览**健康检查 HTTP 路径可在项目 Pipeline 中配置 **`previewHealthCheckPath`**（默认 `/`）。常规 **Linux 站点** Nginx 配置写入采用 **临时文件 + 原子 `rename`**，与预览片段策略一致。SSH/rsync 失败仍附带 `code`/`errno`（若有）。
- **产物清理**：已在构建成功后按 `artifactRetention` 自动执行（见 §2）。

#### Docker 构建支持矩阵（简要）

| Worker 环境 | `SHIPYARD_BUILD_USE_DOCKER=true` 行为 |
|-------------|--------------------------------------|
| **Linux**（含多数生产 Worker） | 使用 `docker run` 在容器内执行构建相关命令（需已安装 Docker CLI 且 daemon 可用） |
| **macOS / Windows** | **不支持**容器路径：启动时 **warn**，构建仍用本机 `child_process` |
| **Linux 无 Docker / `docker` 调用失败** | 构建步骤 **失败**（与显式开启的预期一致） |

**Docker rootless 与卷（运维）**：若使用 [Rootless Docker](https://docs.docker.com/engine/security/rootless/)，请让运行 Worker 的同一用户能访问 daemon（常见做法：`export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock`，或 `docker context use rootless`）。构建目录为宿主 `/tmp/build-<deploymentId>` 绑定挂载到容器 `/workspace`；**依赖缓存目录**在宿主 `SHIPYARD_BUILD_DEPS_CACHE_PATH`（或默认临时目录下 `shipyard-build-deps-cache`），由 Worker 进程在宿主侧读写（与容器内 `node_modules` 通过挂载目录同步，无需把缓存根再挂进容器）。请保证上述路径对该用户可写、磁盘充足。

**Docker 资源与安全（v0.5+）**：`docker run` 默认 **`--network=bridge`**（保证 registry 访问）、**不**加 `--privileged`**。可通过 `SHIPYARD_BUILD_DOCKER_CPUS`、`SHIPYARD_BUILD_DOCKER_MEMORY` 限制 CPU/内存；`SHIPYARD_BUILD_DOCKER_NETWORK` 可选 `bridge`/`host`/`none`/`container:<name>`；仅在确有需要时设 `SHIPYARD_BUILD_DOCKER_PRIVILEGED=true`（高危）。构建日志会打印一行 `[docker-build] run opts: …` 摘要。

**依赖缓存淘汰顺序（v0.5+）**：若配置 `SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS`，在每次写入缓存后 **先** 按指纹目录 mtime 删除过期项（日志 `cache_evict_ttl`），**再** 若配置 `SHIPYARD_BUILD_DEPS_CACHE_ORG_MAX_MB`（或 `_MAX_BYTES`）则对该 **组织** 子树做 LRU，**最后** 对全局总占用做 LRU（日志 `cache_evict` / `cache_evict_org`）。

### 自托管 Git 实例兼容（简表）

| 平台 | 建议自测项 | 说明 | 参考文档 | 版本 / 已知问题 |
|------|------------|------|----------|----------------|
| GitLab | Webhook `merge_requests_events`、MR API 评论 | 自建版本与 gitlab.com 字段可能略有差异 | [Webhooks · GitLab Docs](https://docs.gitlab.com/ee/user/project/integrations/webhook_events.html) | 建议 ≥ 15.x；字段差异见官方 Webhook 文档 |
| Gitea | `pull_request` 事件、PR 评论 API | 需在 `GitConnection.baseUrl` 填实例根 URL | [Webhooks · Gitea Docs](https://docs.gitea.com/usage/webhooks) | 建议 ≥ 1.21；issue 可在仓库 [Issues](https://github.com/ChrisLey520/shipyard/issues) 检索 `gitea` |
| Gitee | `merge_request_hooks` | 企业版与公有云文档路径请以实例文档为准 | [WebHook 说明 · Gitee 帮助](https://gitee.com/help/articles/4313) | 企业版以实例文档为准 |
