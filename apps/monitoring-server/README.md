# @shipyard/monitoring-server

独立监控 Ingest 与管理 API（NestJS + Prisma + **PostgreSQL**）。

## 重要：独立数据库

**勿将 `MONITORING_DATABASE_URL` 指向 Shipyard 主库 `shipyard`**。`prisma db push` 会以本包 schema **覆盖**目标库，会删除主业务表。请使用 **单独数据库**（例如 `monitoring`）。

首次创建库（本机 docker-compose 的 Postgres）：

```bash
psql "postgresql://shipyard:shipyard_pass@127.0.0.1:5432/postgres" -c "CREATE DATABASE monitoring;"
# 或执行仓库内 [scripts/create-monitoring-database.sql](../../scripts/create-monitoring-database.sql)
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `MONITORING_DATABASE_URL` | **必填（生产）**；默认开发值为 `postgresql://shipyard:shipyard_pass@127.0.0.1:5432/monitoring` |
| `MONITORING_PORT` | 默认 `3030` |
| `MONITORING_ADMIN_TOKEN` | 管理接口 `X-Admin-Token`；未设置则管理接口拒绝 |
| `MONITORING_CORS_ORIGIN` | `*` 或未设置时 `origin: true`；否则逗号分隔域名 |
| `MONITORING_SEED_PROJECT_KEY` / `MONITORING_SEED_INGEST_TOKEN` | `pnpm db:seed` 写入默认项目 |
| `MONITORING_EVENT_RETENTION_DAYS` | 事件保留天数，默认 `30`；每日清理 |
| `MONITORING_SOURCEMAP_ROOT` | Source map 文件目录，默认 `<cwd>/data/sourcemaps` |
| `MONITORING_SOURCEMAP_MAX_BYTES` | 单文件上限，默认 5MB |
| `MONITORING_WEBHOOK_ALLOW_HTTP_LOCAL` | 设为 `true` 时告警 Webhook 允许 `http`（仅本地调试） |

## 常用命令

```bash
# 在已创建 monitoring 库后
pnpm --filter @shipyard/monitoring-server db:push   # 建表（勿对主库执行）
pnpm --filter @shipyard/monitoring-server db:seed   # 默认项目
pnpm --filter @shipyard/monitoring-server dev       # 开发
pnpm --filter @shipyard/monitoring-server build     # 编译（含 prisma generate → src/generated/monitoring-prisma）
```

## 健康检查

- `GET /health` → `{ "ok": true }`

## 功能摘要（v2）

- Ingest：`POST /v1/ingest/batch`（Bearer + projectKey）
- Source map：`POST /v1/sourcemaps`（multipart：`release` + `file`，Bearer 与 ingest 相同）
- 管理：`GET /v1/admin/events`、`GET /v1/admin/events/:id`（符号化堆栈）、`GET /v1/admin/metrics/hourly`、`GET|POST /v1/admin/projects`、`POST .../rotate-token`、`GET|POST /v1/admin/alert-rules`
- 定时任务：事件保留、告警规则（企微 / 飞书 / webhook）每分钟评估

契约见 `packages/monitoring-contracts/openapi/v1.yaml`。

## 相关文档

- **客户端自定义采集（插件）**：[packages/monitoring-sdk/README.md](../../packages/monitoring-sdk/README.md)
- **监控 v2 需求**：[.cursor/plans/monitoring-v2-需求规格.md](../../.cursor/plans/monitoring-v2-需求规格.md)
