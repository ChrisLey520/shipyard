# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-04-11

### Added

- **Build**：`ProcessBuildExecutor` / `DockerBuildExecutor` 与共享类型（`container-build-runner.types.ts`、`process-build.executor.ts`），`BuildWorker` 通过二者编排宿主与容器内命令；Vitest 覆盖进程执行器边界。
- **Build cache**：依赖缓存淘汰管道 `runDepsCacheEvictionPipeline` 在缓存根下使用 **`.shipyard-deps-evict.lock`**（`proper-lockfile`）**跨进程串行化** 仅 **淘汰路径**；同步体 `runDepsCacheEvictionPipelineSync` 供持锁场景或单测；锁获取失败时跳过当次淘汰并记录 `evict_lock_acquire_failed`。
- **Notifications**：项目级可选 **`notificationMessageTemplate`**（Prisma + `PATCH /projects` + Web「通知」页）；入队时若配置则作为消息骨架，占位符含 **`{{message}}` / `{{body}}`**（系统默认文案）及既有字段。
- **CI**：`git-smoke` 支持 **`GIT_SMOKE_URLS`**（多行 URL，优先于 `GIT_SMOKE_BASE_URL`）。
- **Docs / scripts**：[`docs/self-hosted-git.md`](docs/self-hosted-git.md) 拆分 CI 探测与 API 版本说明；[`scripts/probe-git-api-version.mjs`](scripts/probe-git-api-version.mjs) 匿名探测 GitLab/Gitea version 端点。

### Documentation

- README / README-EN：多 Worker / 并发 Job 与共享缓存根时的淘汰锁说明；**Podman** 与 `docker` CLI 兼容说明（非一等支持）；自托管 Git 链至 `docs/self-hosted-git.md`。

[0.6.0]: https://github.com/ChrisLey520/shipyard/releases

## [0.5.0] - 2026-04-12

### Added

- **Build (Docker)**：显式 **`--network`**（默认 `bridge`）、可选 **`--cpus` / `--memory`**（`SHIPYARD_BUILD_DOCKER_CPUS`、`SHIPYARD_BUILD_DOCKER_MEMORY`）；**默认不** `--privileged`，仅当 `SHIPYARD_BUILD_DOCKER_PRIVILEGED=true` 时开启；构建日志输出 `[docker-build] run opts: …` 摘要。
- **Build cache**：可选 **`SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS`**（按指纹目录 mtime TTL 淘汰，日志 `cache_evict_ttl`）；可选 **单组织** 上限 `SHIPYARD_BUILD_DEPS_CACHE_ORG_MAX_MB` / `_MAX_BYTES`（日志 `cache_evict_org`）；写入缓存后淘汰顺序为 **TTL → 组织 LRU → 全局 LRU**。
- **Notifications**：入队消息支持占位符 `{{projectSlug}}`、`{{orgSlug}}`、`{{event}}`、`{{detailUrl}}`、`{{deploymentId}}`、`{{approvalId}}`（`@shipyard/shared` `renderNotificationPlaceholders`）。
- **CI**：可选 job **`git-smoke`**，当配置 secret **`GIT_SMOKE_BASE_URL`** 时对 URL 发起只读 `HEAD`/`GET` 探测。

### Changed

- **Behavior**：Docker 构建的 `docker run` 参数由隐式默认变为 **显式传入** `--network=bridge` 等（关闭 Docker 或未使用容器路径时无影响）。

### Documentation

- README / README-EN：Docker 资源变量、缓存淘汰顺序、自托管矩阵「版本/issue」列；`.env.example` 同步。

[0.5.0]: https://github.com/ChrisLey520/shipyard/releases

## [0.4.0] - 2026-04-11

### Added

- **Build (Docker)**：Linux 上 `SHIPYARD_BUILD_USE_DOCKER=true` 时，在容器内执行安装/校验/测试/构建（`SHIPYARD_BUILD_DOCKER_IMAGE`，默认 `node:20-bookworm`）；非 Linux 记录告警并沿用 `child_process`。
- **Build cache**：`SHIPYARD_BUILD_DEPS_CACHE_MAX_BYTES` / `SHIPYARD_BUILD_DEPS_CACHE_MAX_MB` 控制依赖缓存总上限，超出后按指纹目录 **LRU（mtime）** 淘汰；缓存指纹纳入 **Node 主版本** 与可选 **`.nvmrc`** 内容哈希。
- **Deploy**：SSR 预览远端健康检查路径可由项目 **`previewHealthCheckPath`** 配置；常规 Linux 站点 Nginx 配置采用 **临时文件 + 原子替换**。
- **Deploy**：`[precheck]` 在缺少 `node` 时补充 **nvm / login shell / PATH** 指引（不强制安装 nvm）。
- **Notifications**：**企业微信** 机器人 Webhook（`NotificationChannel.WECOM`，markdown 载荷）。

### Changed

- **Behavior**：`SHIPYARD_BUILD_USE_DOCKER` 在 Linux 上由「仅告警」改为真实容器执行路径（见上文）。

### Documentation

- README / README-EN：Docker 支持矩阵、构建缓存与运维变量、自托管 Git 文档链接列。

[0.4.0]: https://github.com/ChrisLey520/shipyard/releases

## [0.3.0] - 2026-04-11

### Added

- **PR Preview (SSR)**：蓝绿式双槽位 PM2（`-bg0`/`-bg1`）、候选实例远端 HTTP 健康检查、Nginx 预览片段原子写入（临时文件 + `mv`）与失败时尽量回滚片段；`Preview.ssrBgSlot` 记录当前活跃槽。
- **Deploy**：SSH 后 **`[precheck]`** 检测 `bash`/`rsync`/（按需）`nginx`、`node`/`pm2`；预览与常规 Linux 部署路径接入。
- **Notifications**：飞书 Webhook 在配置 `secret` 时追加签名校验 query（秒级时间戳 + HMAC-SHA256）；Slack 可选 `secret` 映射为 `Authorization: Bearer`（供网关侧使用）。
- **BuildWorker**：按组织 + 包管理器 + lockfile 指纹缓存/复用 `node_modules`（`SHIPYARD_BUILD_DEPS_CACHE_PATH`）；预留 `SHIPYARD_BUILD_USE_DOCKER` 仅告警不切换执行器。

### Changed

- **Preview teardown**：同时清理 `…-bg0`/`…-bg1` 及遗留主名 PM2 进程。

### Documentation

- README：路线图与自托管 Git 简表、构建缓存与 Docker 预留说明。

[0.3.0]: https://github.com/ChrisLey520/shipyard/releases

## [0.2.0] - 2026-04-11

### Added

- **Artifacts**: `ArtifactRetentionApplicationService` — after each successful build, enforce `Organization.artifactRetention` (count-based) on `BuildArtifact` rows and `ARTIFACT_STORE_PATH` tarballs.
- **Workers**: publishing `worker:new-org` on organization create so Build, Deploy, and Notify workers register new org queues without restart.
- **Notifications**: DingTalk custom robot **加签** when `secret` is set (HMAC-SHA256 + `timestamp` / `sign` query params).
- **CI**: GitHub Actions workflow with unit/typecheck/test and optional Playwright E2E (PostgreSQL + Redis services).

### Changed

- **Build worker**: `appendLog` writes DB and Redis Pub/Sub independently so one failure does not drop the other.
- **Deploy**: failure messages include SSH / system `code` or `errno` when present; `appendLogLine` uses the same DB/Redis split as build logs.

### Documentation

- README: notification section updated for dynamic workers, DingTalk signing, and artifact retention; roadmap §3 adjusted for implemented items.

[0.2.0]: https://github.com/ChrisLey520/shipyard/releases
