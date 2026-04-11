# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
