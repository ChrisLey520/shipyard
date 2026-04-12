# Shipyard 监控子系统 v2 需求规格说明书

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 对应版本 | **监控体系 v2**（独立于 Shipyard 主版本号，可与未来 v0.5 等并行发版） |
| 基线 | 当前 MVP：[`packages/monitoring-sdk`](../../packages/monitoring-sdk)、[`apps/monitoring-server`](../../apps/monitoring-server)（SQLite + Ingest + Admin）、[`apps/monitoring-web`](../../apps/monitoring-web)、[`packages/monitoring-contracts`](../../packages/monitoring-contracts) |
| 关联路线图 | [.cursor/plans/monitoring-v2-路线图.plan.md](./monitoring-v2-路线图.plan.md) |
| 前置规划 | [.cursor/plans/monitoring-sdk-三端方案.plan.md](./monitoring-sdk-三端方案.plan.md)（Phase B/C 缺口由本文承接） |
| 读者 | 产品/研发/测试/运维、Agent 实现参考 |

---

## 1. 背景与目标

### 1.1 背景

监控 MVP 已具备：跨 Web / uni-app SDK（含插件与面包屑）、OpenAPI 契约、独立 Ingest 与按 `projectKey` 去重入库、管理台事件列表与 JSON 详情。与 [.cursor/plans/monitoring-sdk-三端方案.plan.md](./monitoring-sdk-三端方案.plan.md) 对照，**Phase B/C** 尚未闭合：Source map 接口为占位（501）、无符号化堆栈、无数据保留与聚合、无趋势看板、无告警、项目管理依赖 seed。

### 1.2 版本目标（一句话）

在 **不与 Shipyard 业务库绑定** 的前提下，使监控平台达到 **可规模化存储（PG 基线）、可符号化排查、可运营（保留/聚合/看板）、可告警（企业微信 + 飞书 + 可选 Webhook）**，并补齐 SDK 侧 **可选持久化队列** 的规格与边界。

### 1.3 成功标准（版本级）

- P0 项均可按第 9 节验收；**PostgreSQL** 部署路径在 README 可跟做。
- 契约变更（OpenAPI / JSON Schema）有 **版本策略** 说明，并与 SDK 主版本或文档同步。
- 新增/变更环境变量写入 [`apps/monitoring-server/README.md`](../../apps/monitoring-server/README.md) 与（若存在）`.env.example`。

---

## 2. 决策与边界

### 2.1 已定决策（审阅确认）

| 决策 | 内容 |
|------|------|
| **与 Shipyard 业务** | **不绑定**：`projectKey` / `MonitoringProject` 独立于 Shipyard 组织/项目；无共享登录、无外键同步。 |
| **告警渠道** | v2 **必须**支持 **企业微信** 与 **飞书** 投递；**通用 Webhook** 为补充。凭据与路由仅在监控服务/管理台配置，**不**读取 Shipyard 通知配置表。 |
| **存储** | **双目标**：开发可继续 **SQLite** 以降低门槛；**生产/预发推荐 PostgreSQL**。高并发写入、预聚合、保留任务以 **PG 行为为验收基准**。因 Prisma **单 schema 仅支持一个 `provider`**，具体切换策略（例如：以 PG 为唯一 provider + 本地 Docker、或文档化双环境 schema 方案）在实现阶段以 **ADR 摘要** 定稿并写入 README。 |

### 2.2 与路线图对齐的优先级

| 级别 | 内容 |
|------|------|
| **P0** | Source map 上传与存储 + 错误堆栈符号化（管理台可读）；PG 部署文档与数据保留（TTL/删除任务）；管理台基础趋势/聚合（至少按 `release` + `type` 维度的错误计数时间序列）；项目管理（创建项目、轮换 ingest token）经 Admin API + 管理台；告警规则 MVP + **企微 + 飞书** 各一条最小可用投递路径；契约版本与兼容策略文档 |
| **P1** | 通用 Webhook 告警；更细维度聚合（`route` / `platform`）；可选归档导出；SDK Web **IndexedDB** 持久化队列（容量与敏感字段策略）；管理 API 简单审计日志或操作留痕 |
| **Stretch** | 小程序侧持久化队列；监控服务自身 Prometheus 指标/健康度大盘；异步符号化队列（与同步符号化并存时文档说明优先级） |

### 2.3 Out of Scope

- **Session Replay**、录屏类能力。
- **多租户 SaaS 级**计费、组织级硬隔离（本版不要求）。
- **与 Shipyard 主产品** 的项目/用户/通知配置 **业务绑定**（见 2.1）。
- **本版不要求**从仓库移除 SQLite 开发路径（与「双目标」一致）。
- 钉钉、Slack 等渠道（`packages/shared` 中枚举可存在）**非 v2 必达**，可作为后续版本。

---

## 3. 术语

| 术语 | 含义 |
|------|------|
| 符号化 | 将压缩栈帧映射回源码位置（依赖 `release` + source map） |
| 保留策略 | 按事件 `receivedAt`（或服务端时间）删除或归档过期数据 |
| 预聚合 | 定时或流式汇总指标，避免管理台仅依赖原始事件表全表扫描 |
| 静默期 | 告警触发后在一段时间内同规则不重复通知 |

---

## 4. 功能需求

### 4.1 Source map 与符号化（FR-SM）

**FR-SM-001 实现上传接口**

- **描述**：实现 [`packages/monitoring-contracts/openapi/v1.yaml`](../../packages/monitoring-contracts/openapi/v1.yaml) 中 `POST /v1/sourcemaps`（`multipart/form-data`，`release` + `file`），成功返回 **2xx**（与契约一致，非 501）。须与现有 Ingest 鉴权模型兼容（Bearer ingest token 或契约中约定的 build token 变体，在实现与文档中统一）。
- **优先级**：P0  
- **锚点**：[`apps/monitoring-server/src/sourcemaps/sourcemaps.controller.ts`](../../apps/monitoring-server/src/sourcemaps/sourcemaps.controller.ts)

**FR-SM-002 存储与隔离**

- **描述**：按 **`projectKey`（或 projectId）+ `release`** 存储 map 文件；禁止跨项目读取。磁盘路径或对象存储由实现选定，README 说明备份与容量。
- **优先级**：P0

**FR-SM-003 安全**

- **描述**：Source map 可能包含源码片段；须 **访问控制**（仅管理端/服务端内部读取）、**HTTPS 传输**；文档要求构建侧避免将密钥硬编码进 map。上传大小上限与契约一致并可在服务端配置。
- **优先级**：P0

**FR-SM-004 堆栈符号化**

- **描述**：对 `type=error`（及契约中约定含 stack 的类型）在 **管理台事件详情** 展示 **符号化后的堆栈**（至少支持浏览器常见格式）；无匹配 `release` 的 map 时 **降级**为原始堆栈并提示「未上传 sourcemap」。实现可选 **同步**（请求时计算）或 **异步**（任务队列）；若异步，详情页须展示「符号化中」或轮询结果（Stretch 可强化）。
- **优先级**：P0

---

### 4.2 存储、保留与聚合（FR-STORE）

**FR-STORE-001 PostgreSQL 生产路径**

- **描述**：提供 **生产可用** 的 PostgreSQL 连接方式（`MONITORING_DATABASE_URL`）、迁移/ `db push` 说明；**验收以 PG 为准**。SQLite 仅作为 **低流量开发** 选项，README 写明并发与保留任务限制。
- **优先级**：P0  
- **锚点**：[`apps/monitoring-server/prisma/schema.prisma`](../../apps/monitoring-server/prisma/schema.prisma)

**FR-STORE-002 保留策略**

- **描述**：可配置 **事件保留天数**（环境变量或 DB 配置）；后台任务定期删除过期 `MonitoringEvent`（以 `receivedAt` 为准）。删除须记录日志或可观测指标（条数）。
- **优先级**：P0

**FR-STORE-003 查询与索引**

- **描述**：为列表/聚合常用条件补充索引（至少覆盖 `projectId + receivedAt`、`type`、`platform`、`release` 等组合，以实现为准）；避免管理台默认查询全表扫导致超时。
- **优先级**：P0

**FR-STORE-004 预聚合（与看板联动）**

- **描述**：为管理台趋势图提供 **预聚合表或等价机制**（按小时/天 bucket）；聚合维度至少含 `projectId`、`type`、`release`；**设计以 PG 为准**。
- **优先级**：P0（最小可用聚合）；更细维度见 P1

**FR-STORE-005 归档导出（Stretch / P1）**

- **描述**：可选：将过期事件导出为文件后再删除（格式 JSONL/Parquet 择一并在文档说明）。
- **优先级**：P1

---

### 4.3 管理台与项目生命周期（FR-ADMIN）

**FR-ADMIN-001 趋势与聚合展示**

- **描述**：[`apps/monitoring-web`](../../apps/monitoring-web) 增加 **图表**（如近 7/30 日错误量趋势），数据源来自 FR-STORE-004；可按 `projectKey`、`release` 筛选。
- **优先级**：P0  
- **锚点**：[`apps/monitoring-web/src/views/EventsList.vue`](../../apps/monitoring-web/src/views/EventsList.vue) 及周边路由

**FR-ADMIN-002 事件详情增强**

- **描述**：在现有 JSON 展示基础上，突出 **符号化堆栈**、面包屑可读区块；保留原始 JSON 折叠查看。
- **优先级**：P0

**FR-ADMIN-003 项目管理**

- **描述**：通过 **Admin API + 管理台 UI** 支持 **创建监控项目**、**轮换 `ingestToken`**、只读展示 `projectKey`；替代「仅 `db:seed`」作为正式运维路径。须校验 `X-Admin-Token`（或后续方案）。
- **优先级**：P0  
- **锚点**：[`apps/monitoring-server/src/admin/`](../../apps/monitoring-server/src/admin/)

---

### 4.4 告警（FR-ALERT）

**FR-ALERT-001 规则模型**

- **描述**：支持 **阈值规则**（例如：某 `projectKey` 在滑动窗口内 `error` 计数超阈触发）；支持 **静默期**（分钟级可配置）；规则与通知目标存储在监控库（新表或等价）。
- **优先级**：P0

**FR-ALERT-002 企业微信**

- **描述**：告警可投递至 **企业微信**（至少支持 **群机器人 Webhook** 或官方文档中的一种固定形态，在实现时锁定并在 README 给配置样例）。**不**依赖 Shipyard 业务表。
- **优先级**：P0

**FR-ALERT-003 飞书**

- **描述**：告警可投递至 **飞书**（至少支持 **群机器人 Webhook** 或官方文档中的一种固定形态，同上）。
- **优先级**：P0

**FR-ALERT-004 通用 Webhook**

- **描述**：可选 POST JSON payload 到用户 URL；须 SSRF/内网防护（禁止随意访问 metadata IP 等，策略在实现中写明）。
- **优先级**：P1

**FR-ALERT-005 代码复用（非绑定）**

- **描述**：若与主仓库 [`packages/shared/src/enums.ts`](../../packages/shared/src/enums.ts) 中 `NotificationChannel`（含 `WECOM`/`FEISHU`）类型一致，**可**复用以减少重复；**不得**引入对 Shipyard 业务 Service 或 DB 的依赖。
- **优先级**：P1

---

### 4.5 SDK 持久化队列（FR-SDK）

**FR-SDK-001 Web 持久化队列**

- **描述**：在 [`packages/monitoring-sdk`](../../packages/monitoring-sdk) Web 路径提供 **可选** 持久化队列（如 IndexedDB）：容量上限、条数上限、**敏感字段默认不落盘**（与现有脱敏策略一致）；开启方式在 README 与类型中显式。失败回退内存队列。
- **优先级**：P1  
- **锚点**：[`packages/monitoring-sdk/src/core/client.ts`](../../packages/monitoring-sdk/src/core/client.ts)

**FR-SDK-002 小程序持久化队列**

- **描述**：uni 路径 **Stretch**：可选本地存储补发策略；须通过 **隐私与包体** 评审（单独小节写在 SDK README）。
- **优先级**：Stretch

---

## 5. 契约与版本（FR-CONTRACT）

**FR-CONTRACT-001 版本策略**

- **描述**：`monitoring-contracts` 中 OpenAPI `info.version` 与破坏性变更策略写入包内 README：SDK 与服务端须对齐同一 major；不兼容时 bump major 并列出迁移说明。
- **优先级**：P0  
- **锚点**：[`packages/monitoring-contracts/openapi/v1.yaml`](../../packages/monitoring-contracts/openapi/v1.yaml)

**FR-CONTRACT-002 校验与测试**

- **描述**：Ingest 请求体继续与 JSON Schema 校验；关键路径增加 **契约回归测试**（服务端或包内，择一落地）。
- **优先级**：P1

---

## 6. 非功能需求（NFR）

| ID | 描述 | 优先级 |
|----|------|--------|
| NFR-INGEST-001 | Ingest 限流：按 project + IP（或等价）可配置；超限返回 429 与可解析 body | P0 |
| NFR-OPS-001 | `monitoring-server` 提供 **健康检查**（如 Nest `GET /health`），文档说明负载均衡探活 | P0 |
| NFR-OPS-002 | 关键路径结构化日志（ingest 批量接受/拒绝条数、告警发送失败原因） | P1 |
| NFR-SEC-001 | Admin API 与 source map 下载路径须鉴权；ingest token 轮换后旧 token 立即失效 | P0 |

---

## 7. 风险与依赖

| 风险 | 缓解 |
|------|------|
| Prisma SQLite 与 PG 双目标 | ADR 明确单一 schema 策略；CI 至少跑 PG 一条线 |
| Source map 体积与磁盘 | 上限 + 按 release 清理策略 |
| 企微/飞书 API 变更 | README 链到官方文档版本；集成测试可用 mock |
| 预聚合与实时一致性 | 文档说明延迟（如 1～5 分钟） |

---

## 8. 代码锚点索引（实现检索）

| 模块 | 路径 |
|------|------|
| SDK 核心 | `packages/monitoring-sdk/src/core/` |
| Web / uni 初始化 | `packages/monitoring-sdk/src/web/init.ts`、`packages/monitoring-sdk/src/uni/init.ts` |
| Ingest / Admin | `apps/monitoring-server/src/ingest/`、`apps/monitoring-server/src/admin/` |
| 管理台 | `apps/monitoring-web/src/` |
| 契约 | `packages/monitoring-contracts/` |

---

## 9. 验收标准汇总

| 域 | 验收要点 |
|----|----------|
| FR-SM | `POST /v1/sourcemaps` 非 501；按项目+release 存；详情页错误堆栈可符号化，无 map 时降级有提示 |
| FR-STORE | PG 部署文档可复现；保留任务删除过期数据；列表/趋势查询在约定数据量下可接受；预聚合驱动看板 |
| FR-ADMIN | 管理台可见趋势图；可创建项目并轮换 token；详情含符号化栈 |
| FR-ALERT | 规则触发后 **企微** 与 **飞书** 各能收到一条符合模板的消息；静默期生效 |
| FR-CONTRACT | 契约版本与兼容策略有文档 |
| NFR | 健康检查可用；ingest 429 行为符合文档 |

---

## 10. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-12 | 1.0 | 初稿；与规划决策（不绑定、企微/飞书、存储双目标）一致 |
