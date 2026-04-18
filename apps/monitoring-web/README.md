# @shipyard/monitoring-web

独立监控管理台（Vue 3 + Vite + Naive UI）。

## 环境变量（`.env`）

```
VITE_MONITORING_API=/monitoring-api
VITE_MONITORING_ADMIN_TOKEN=与 MONITORING_ADMIN_TOKEN 一致
```

开发时 Vite 将 `/monitoring-api` 代理到 `http://127.0.0.1:3030`（可用 `VITE_MONITORING_API_PROXY` 覆盖）。

```bash
pnpm --filter @shipyard/monitoring-web dev
```

默认端口 `5174`。

## 相关文档

- **监控 SDK 与客户端插件开发**：[packages/monitoring-sdk/README.md](../../packages/monitoring-sdk/README.md)（含插件开发指南、事件类型与接入方式）。
