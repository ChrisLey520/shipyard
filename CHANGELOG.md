# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
