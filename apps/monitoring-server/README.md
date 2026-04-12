# @shipyard/monitoring-server

独立监控 Ingest 与管理 API（NestJS + Prisma + SQLite 默认）。

## 环境变量

| 变量 | 说明 |
|------|------|
| `MONITORING_DATABASE_URL` | 可选；未设置时使用 `file:<cwd>/prisma/monitoring.db` |
| `MONITORING_PORT` | 默认 `3030` |
| `MONITORING_ADMIN_TOKEN` | 管理接口 `X-Admin-Token` 校验；未设置则管理接口拒绝 |
| `MONITORING_CORS_ORIGIN` | `*` 或未设置时 `origin: true`；否则逗号分隔域名 |
| `MONITORING_SEED_PROJECT_KEY` / `MONITORING_SEED_INGEST_TOKEN` | `pnpm db:seed` 写入默认项目 |

## 常用命令

```bash
pnpm --filter @shipyard/monitoring-server db:push   # 建表
pnpm --filter @shipyard/monitoring-server db:seed # 写入 default 项目
pnpm --filter @shipyard/monitoring-server dev       # 开发
```

契约见 `packages/monitoring-contracts/openapi/v1.yaml`。

## 相关文档

- **客户端自定义采集（插件）开发说明**：[packages/monitoring-sdk/README.md](../../packages/monitoring-sdk/README.md) 中的「插件开发指南」。
