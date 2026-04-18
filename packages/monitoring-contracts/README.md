# @shipyard/monitoring-contracts

监控 SDK 与独立 Ingest 服务之间的 **版本化契约**。

## 版本策略

- URL 前缀：`/v1/...`。破坏性变更递增主版本（`/v2`），并保留旧版一段时间。
- SDK `sdkVersion` 与契约文档中的 `info.version` 独立：契约版本描述 HTTP API；SDK 自行 semver。

## Ingest 集成说明

### CORS

若上报域名与 Ingest **不同源**，服务端必须：

- 对 `OPTIONS` 预检返回 `204`，并包含 `Access-Control-Allow-Methods: POST, OPTIONS`、`Access-Control-Allow-Headers`（至少包含 `Content-Type`、`Authorization` 及自定义头若使用）。
- 对 `POST /v1/ingest/batch` 返回上述 CORS 头；生产环境 `Access-Control-Allow-Origin` 建议白名单业务域名，开发可用 `*`（勿带 credentials）。

### CSP

业务站点 CSP 的 `connect-src` 须 **包含 Ingest 源**，否则浏览器会静默拦截上报。

### 语义

- **`receivedAt`**：仅服务端写入，客户端忽略；统计以服务端时间为准。
- **`eventId` 去重**：同一 `projectKey` 下相同 `eventId` 重复提交应被合并或丢弃，避免重试放大事件量。

详见 [openapi/v1.yaml](./openapi/v1.yaml)。
