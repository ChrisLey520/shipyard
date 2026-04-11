# Shipyard (Self-hosted CI/CD for Frontend)

Shipyard is a multi-tenant, self-hosted CI/CD platform for deploying frontend projects (static sites + SSR).  
Tech stack: **NestJS + Prisma + PostgreSQL + Redis + BullMQ** (backend/worker), **Vue 3 + Vite + Pinia + Naive UI** (web).

Chinese version: `README.md`

## Monorepo layout

- `apps/server` — NestJS API server + Prisma schema
- `apps/web` — Vue 3 admin UI
- `packages/shared` — shared enums/DTOs/utils (**pure functions only**, no encryption)

## Prerequisites

- Node.js (recommended: 20+)
- pnpm (**pnpm**, not npm)
- Docker + Docker Compose (for local postgres/redis; optional for running everything)

## Environment variables

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — JWT signing secret (must change in production)
- `ENCRYPTION_KEY` — master key for AES-256-GCM encryption (must change in production)
- `APP_URL` — web URL (used in email links, commit status `target_url`, etc.)
- `SERVER_PUBLIC_URL` — public API base URL for webhooks and OAuth `redirect_uri`
- `ARTIFACT_STORE_PATH` — artifact directory path
- **Build deps cache**: `SHIPYARD_BUILD_DEPS_CACHE_PATH`, `SHIPYARD_BUILD_DEPS_CACHE_MAX_BYTES` or `SHIPYARD_BUILD_DEPS_CACHE_MAX_MB` (see `.env.example`)
- **Docker builds**: `SHIPYARD_BUILD_USE_DOCKER`, `SHIPYARD_BUILD_DOCKER_IMAGE` (Linux workers only; see matrix below)

## Operations: nvm on SSH deploy targets

Shipyard runs `[precheck]` and deploy steps over SSH using a **non-login, non-interactive** shell by default, so `~/.bashrc` (where nvm often injects `PATH`) may not run.

- **nvm is not required**; if you use it, ensure **`node` is on the PATH** for the shell Shipyard actually uses (e.g. initialize nvm in `~/.bash_profile` / `~/.profile`, or install a system-wide Node).
- **Self-check** on the target: `bash -lc 'command -v node && node -v'` should match what precheck expects.

## Local development (recommended)

### 1) Start postgres/redis

```bash
docker compose up -d postgres redis
```

### 2) Install dependencies

```bash
pnpm install
```

If pnpm warns about ignored build scripts, approve and rebuild as needed:

```bash
pnpm approve-builds
pnpm rebuild
```

### 3) Prisma (generate client + migrate)

```bash
pnpm --filter @shipyard/server db:generate
pnpm --filter @shipyard/server db:migrate
```

### 4) Run dev servers

In separate terminals:

```bash
pnpm dev:server
pnpm dev:worker
pnpm dev:web
```

Open:

- Web UI: `http://localhost:5173`
- API (Swagger): `http://localhost:3000/api/docs`

## Scripts (root)

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r build
```

## What’s implemented (based on current code)

- **Auth**: register/login, JWT access/refresh, forgot/reset password
- **Multi-tenant orgs**: org list/create, member invite/remove, RBAC
- **Projects**: CRUD, pipeline config, GitConnection (encrypted PAT)
- **Pipeline**: BullMQ per-org queue; default `child_process` build isolation, optional **Docker** on Linux (`SHIPYARD_BUILD_USE_DOCKER`); lockfile + org + pm + **Node major** (+ optional `.nvmrc`) keyed `node_modules` cache with **LRU eviction** by total bytes; `.tar.gz` artifacts; Redis Pub/Sub + Socket.io log streaming
- **Deploy**: SSH deploy (rsync + nginx/pm2 logic), deploy lock, health check + auto rollback
- **Approvals**: protected env approvals list + approve/reject (approve enqueues deploy job)
- **Web UI**: login/register, dashboard, projects/envs/servers/team/approvals, deployment logs (xterm)
- **PR Preview (multi-provider)**: GitHub `pull_request`, GitLab merge request hooks, Gitee `merge_request_hooks`, Gitea `pull_request`; Linux SSH deploy; Redis port pool; Nginx snippets under `/etc/nginx/shipyard-previews.d/` with **atomic write** (`mv`); **SSR blue/green** with alternating PM2 slots (`-bg0`/`-bg1`), configurable **`previewHealthCheckPath`** for the candidate HTTP check, then Nginx cutover and teardown of the old slot / legacy process name; old port released after success; failed deploy rolls back the new port lease in Redis; PR comments as in the Chinese README; fork PRs skipped when head/base repos differ; **Linux production site** Nginx configs use the same **temp file + atomic rename** pattern where applicable

## Next phase roadmap

The following items are the **next phase** priorities (ordered by “works end-to-end → usable → operable”), aligned with the original plan and the current codebase.

### 1) Git integration enhancements (multi-provider + automation)

- **Auto webhook register/unregister**: register webhooks on project creation; unregister on project deletion (using `GitConnection.remoteWebhookId`)
- **More providers**: GitLab / Gitee / Gitea **push + merge-request preview** webhooks (signature verification + idempotency) are implemented; further provider-specific edge cases or events remain incremental
- **Commit status writeback**: update commit status for build start/success/failure (GitHub/GitLab/Gitee/Gitea)
- **Phase 2 OAuth (optional)**: OAuth flow (encrypted access/refresh/tokenExpiresAt + auto refresh)

### 2) PR Preview (optional follow-ups)

- **Instance compatibility**: self-hosted GitLab / Gitea / Gitee versions may differ from public-cloud API docs for hook PATCH fields or comment endpoints—verify against your instance’s official webhook and REST docs before production.
- Optional product policy: fork PR previews and stronger isolation (beyond “skip fork” today).

### 3) Notification system

- Per-project **REST CRUD** and admin UI tab; BullMQ `notify-{orgId}` worker.
- Channels: `webhook`, `email` (Nodemailer), Feishu, DingTalk, Slack, **WeCom (WeChat Work)** robot webhooks (markdown payload), with encrypted secrets where applicable.
- Outbound HTTP(S) uses **`assertSafeOutboundHttpUrl`**: resolve **all** A/AAAA records and block private/reserved ranges (`isBlockedOutboundIp`).
- Triggers from build/deploy/approval flows enqueue notification jobs (retries + backoff).

**Optional follow-ups**: more channels, richer templates, signing variants.

### 4) Build, cache & deploy hardening

- **Deps cache**: `SHIPYARD_BUILD_DEPS_CACHE_MAX_BYTES` / `_MAX_MB` caps total cache size; **LRU eviction** by fingerprint directory mtime when over budget; `cache_hit` / `cache_miss` logging.
- **Docker (opt-in)**: on **Linux**, `SHIPYARD_BUILD_USE_DOCKER=true` runs install/lint/test/build inside `docker run` with the repo mounted at `/workspace` (`SHIPYARD_BUILD_DOCKER_IMAGE`, default `node:20-bookworm`). **Git clone stays on the host.** On **macOS/Windows**, enabling the flag logs a **warning** and keeps **`child_process`**. Requires a working `docker` CLI + daemon on Linux workers.
- **Deploy `[precheck]`**: after SSH, checks `bash`/`rsync` and conditional `nginx`, `node`/`pm2`; if `node` is missing, logs stronger hints for **login shell, PATH, and nvm** (nvm is not required).
- **Artifact cleanup**: `Organization.artifactRetention` (count-based).

#### Docker build support matrix

| Worker | `SHIPYARD_BUILD_USE_DOCKER=true` |
|--------|----------------------------------|
| **Linux** | Runs build steps in Docker (`docker run`) |
| **macOS / Windows** | **Not supported**: warns, falls back to host `child_process` |
| **Linux without Docker** | Build steps **fail** if Docker cannot run |

**Rootless Docker & volumes**: with [Rootless mode](https://docs.docker.com/engine/security/rootless/), run the Worker as the same user that owns the daemon (e.g. `export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock` or `docker context use rootless`). The build workdir is a host path under `/tmp/build-<deploymentId>` bind-mounted to `/workspace`. The **deps cache root** (`SHIPYARD_BUILD_DEPS_CACHE_PATH` or the default under the system temp dir) is read/written on the host by the Worker (it stays in sync with container `node_modules` via the mounted repo tree; you do not need a second mount of the cache root into the container). Ensure those paths are writable and have enough disk.

### Self-hosted Git compatibility (summary)

| Provider | Notes | Reference |
|----------|-------|-----------|
| GitLab | Self-managed fields may differ from gitlab.com | [Webhook events](https://docs.gitlab.com/ee/user/project/integrations/webhook_events.html) |
| Gitea | Set `GitConnection.baseUrl` to the instance root | [Webhooks](https://docs.gitea.com/usage/webhooks) |
| Gitee | Enterprise vs public docs may differ | [WebHook help (CN)](https://gitee.com/help/articles/4313) |
