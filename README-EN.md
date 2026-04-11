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
- `APP_URL` — web URL (used in email links, etc.)
- `ARTIFACT_STORE_PATH` — artifact directory path

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
- **Pipeline**: BullMQ per-org queue, `child_process` build isolation, `.tar.gz` artifacts, Redis Pub/Sub + Socket.io log streaming
- **Deploy**: SSH deploy (rsync + nginx/pm2 logic), deploy lock, health check + auto rollback
- **Approvals**: protected env approvals list + approve/reject (approve enqueues deploy job)
- **Web UI**: login/register, dashboard, projects/envs/servers/team/approvals, deployment logs (xterm)
- **PR Preview (multi-provider)**: GitHub `pull_request`, GitLab merge request hooks, Gitee `merge_request_hooks`, Gitea `pull_request`; preview deploy to Linux over SSH; Redis port pool; per-preview Nginx under `/etc/nginx/shipyard-previews.d/`; SSR uses a **new port per deploy**, single-SSH `pm2 delete` + `pm2 start`, Nginx to new port, old port released on success, **new port Redis lease rolled back** if deploy fails before DB commit; comments on GitHub / GitLab MR notes / Gitee pull comments / Gitea issue-style PR comments (**Gitea needs instance baseUrl**); fork PRs (different head vs base repo) skipped

## Next phase roadmap

The following items are the **next phase** priorities (ordered by “works end-to-end → usable → operable”), aligned with the original plan and the current codebase.

### 1) Git integration enhancements (multi-provider + automation)

- **Auto webhook register/unregister**: register webhooks on project creation; unregister on project deletion (using `GitConnection.remoteWebhookId`)
- **More providers**: GitLab / Gitee / Gitea **push + merge-request preview** webhooks (signature verification + idempotency) are implemented; further provider-specific edge cases or events remain incremental
- **Commit status writeback**: update commit status for build start/success/failure (GitHub/GitLab/Gitee/Gitea)
- **Phase 2 OAuth (optional)**: OAuth flow (encrypted access/refresh/tokenExpiresAt + auto refresh)

### 2) PR Preview (optional follow-ups)

- **Full blue/green**: e.g. candidate PM2 app name, old/new processes listening in parallel, health check before tearing down the old instance, atomic Nginx switch (`rename` or dual-file pattern) to shrink cutover gaps and “no process” windows.
- **Instance compatibility**: self-hosted GitLab / Gitea / Gitee versions may differ from public-cloud API docs for hook PATCH fields or comment endpoints—verify against your instance’s official webhook and REST docs before production.
- Optional product policy: fork PR previews and stronger isolation (beyond “skip fork” today).

### 3) Notification system completion (config + triggers)

- **Notification config CRUD** (per project): Webhook / Email (Nodemailer) / IM (Feishu/DingTalk/Slack)
- **Trigger points**: build/deploy success/failure, approvals pending/approved/rejected
- SSRF hardening: full IPv4/IPv6 coverage + validate all DNS A/AAAA records

### 4) Build & deploy reliability hardening

- BuildWorker: fix clone/workdir flow, log flush strategy, cache strategy (lockfile-hash based)
- DeployWorker: proper SSH/rsync key handling, remote dependency checks (nginx/rsync/acme.sh/pm2/nvm) with actionable errors
- Artifact cleanup: enforce `Organization.artifactRetention` (count-based retention)
- Docker build isolation (Phase 2): rootless + resource limits + seccomp
