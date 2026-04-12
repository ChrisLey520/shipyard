# Shipyard 环境级特性开关 — 需求规格

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 类型 | 专题需求（非整包版本号） |
| 关联实现计划 | [.cursor/plans/shipyard-环境特性开关.plan.md](./shipyard-环境特性开关.plan.md) |
| 读者 | 产品/研发/测试、Agent 实现与验收参考 |

---

## 1. 背景与目标

### 1.1 背景

当前 Shipyard 内置 **特性开关**（`FeatureFlag`）仅支持 **组织级**（`projectId` 为空）与 **项目级**（`projectId` 非空），无法在 **某一部署环境**（如 `staging` / `production`）内独立维护同名 key。业务上常见诉求是：同一项目下不同环境启用不同实验或配置强度，而不希望为每个环境拆项目。

### 1.2 目标（一句话）

在 **不改变**「特性开关与部署流水线解耦」的前提下，为 `FeatureFlag` 增加 **环境级作用域**：在同一项目、同一环境内 `key` 唯一；管理后台（Web）与小程序（MP）可对环境级开关做与现有一致的 CRUD；服务端以数据库 **部分唯一索引** + 应用层校验保证一致性。

### 1.3 成功标准

- 组织级、项目级、环境级三类数据 **互不混淆**：列表与创建落在正确作用域；非法组合请求被拒绝。
- 迁移后 **现有组织级/项目级数据** 行为不变；新增环境级行不触发与项目级 `(projectId, key)` 的唯一冲突。
- README / README-EN 与 API 行为一致；核心服务具备可回归的 **单元测试**。

---

## 2. 范围与优先级

### 2.1 优先级摘要

| 级别 | 内容 |
|------|------|
| **P0** | Prisma 模型 + 迁移（含修正项目级部分唯一条件、新增环境级部分唯一）；`FeatureFlagsApplicationService` / Controller 扩展；Web + MP 作用域选择与 API 传参；README 更新；服务层单元测试 |
| **P1** | Swagger/文档字符串与错误码说明细化（若与现有控制器风格不一致则本版对齐） |
| **Stretch** | 只读 **resolve** API（按 环境 > 项目 > 组织 合并 `enabled` / `valueJson`）；部署 Worker 或构建期注入 |

### 2.2 Out of Scope（本期不做）

- **运行时合并规则** 的对外 API 或 SDK 缓存拉取（Stretch 另立项）。
- **部署流水线自动读取** 特性开关并改变发布路径（延续「与部署解耦」策略）。
- 将 `releaseConfig` 与 `FeatureFlag` 自动关联或互相校验。

---

## 3. 术语

| 术语 | 含义 |
|------|------|
| 组织级开关 | `FeatureFlag` 行：`projectId == null` 且 `environmentId == null`，在同一 `organizationId` 下 `key` 唯一 |
| 项目级开关 | `projectId != null` 且 `environmentId == null`，在同一 `projectId` 下 `key` 唯一 |
| 环境级开关 | `environmentId != null`，且 `projectId` 等于该环境所属项目；在同一 `environmentId` 下 `key` 唯一 |
| `environmentName` | 与 [Environment](../../apps/server/prisma/schema.prisma) 的 `name` 字段一致，在同一 `projectId` 下唯一（`@@unique([projectId, name])`） |

---

## 4. 功能需求

### 4.1 数据模型（FR-ENVFLAG-DATA）

**FR-ENVFLAG-DATA-001 字段与关系**

- **描述**：`FeatureFlag` 增加可选 `environmentId`，外键指向 `Environment`，`onDelete: Cascade`；`Environment` 增加反向集合 `featureFlags`。
- **描述**：环境级行 **必须** 同时写入 `projectId` = 目标环境所属 `projectId`（与 `environment.projectId` 一致），便于鉴权与查询。
- **优先级**：P0

**FR-ENVFLAG-DATA-002 行语义合法性**

- **描述**：仅允许三种组合：（1）组织级（2）项目级（3）环境级；禁止 `environmentId != null` 且 `projectId == null`；禁止 `environmentId != null` 与 `environment.projectId` 不一致的 `projectId`。
- **优先级**：P0

**FR-ENVFLAG-DATA-003 唯一性（数据库）**

- **描述**：PostgreSQL **部分唯一索引**：
  - 组织级：`(organizationId, key)` WHERE `projectId IS NULL AND environmentId IS NULL`
  - 项目级：`(projectId, key)` WHERE `projectId IS NOT NULL AND environmentId IS NULL`（须 **替换** 旧索引中仅 `projectId IS NOT NULL` 的定义）
  - 环境级：`(environmentId, key)` WHERE `environmentId IS NOT NULL`
- **优先级**：P0

---

### 4.2 HTTP API（FR-ENVFLAG-API）

**FR-ENVFLAG-API-001 查询参数**

- **描述**：在现有 `GET/POST .../feature-flags` 上扩展：可选查询参数 **`environmentName`**（命名与实现计划一致；若实现选用 `environment` 须在 README 单一写清）。
- **描述**：**仅当** 已提供 `projectSlug` 时允许携带 `environmentName`；若仅有 `environmentName` 而无 `projectSlug`，返回 **400** 及明确错误信息。
- **优先级**：P0

**FR-ENVFLAG-API-002 列表行为**

- **描述**：组织级列表：与现有一致（无 `projectSlug`，仅组织级行，`environmentId` 为空）。
- **描述**：项目级列表：有 `projectSlug`、无 `environmentName` 时，仅返回该项目下 **`environmentId` 为空** 的行。
- **描述**：环境级列表：有 `projectSlug` 且有 `environmentName` 时，解析环境后仅返回 **`environmentId` 等于该环境 id** 的行。
- **优先级**：P0

**FR-ENVFLAG-API-003 创建与更新**

- **描述**：创建时根据 `projectSlug` / `environmentName` 组合决定写入组织级 / 项目级 / 环境级；`key` 规则与现有一致（字母开头、长度与字符集不变）。
- **描述**：同作用域内重复 `key` 返回 **409**；与数据库唯一索引一致。
- **描述**：`PATCH` 更新 `key` 时的冲突检测须基于 **该行当前** `projectId` / `environmentId`（含环境级）。
- **描述**：列表与详情响应中增加 **`environmentId`** 字段（环境级非空，其余为 `null`），便于客户端展示当前作用域。
- **优先级**：P0

**FR-ENVFLAG-API-004 鉴权**

- **描述**：沿用现有 `FeatureFlagsController` 角色：列表 `VIEWER`，写操作 `DEVELOPER`；环境须属于 URL 中组织上下文下的项目（与现有一致性校验方式对齐）。
- **优先级**：P0

---

### 4.3 Web 管理端（FR-ENVFLAG-WEB）

**FR-ENVFLAG-WEB-001 作用域选择**

- **描述**：在项目详情 **「特性开关」** Tab 内提供作用域选择：**项目级** 或 **某一环境**（选项来自当前项目的 `environments[].name`）。
- **描述**：切换作用域后列表与增删改均作用于对应 API 作用域；文案区分「项目级」与具体环境名。
- **优先级**：P0

**FR-ENVFLAG-WEB-002 交互一致性**

- **描述**：表格、开关、编辑弹窗与现有 [ProjectFeatureFlagsPanel.vue](../../apps/web/src/pages/projects/components/ProjectFeatureFlagsPanel.vue) 行为一致；无环境时环境级选项不可用或引导先创建环境（产品可选其一，实现需明确且不出现空列表误以为是 bug）。
- **优先级**：P0

---

### 4.4 小程序 MP（FR-ENVFLAG-MP）

**FR-ENVFLAG-MP-001 与 Web 对齐**

- **描述**：[ProjectFeatureFlagsTab.vue](../../apps/mp/src/package-org/components/ProjectFeatureFlagsTab.vue) 与 [feature-flags API](../../apps/mp/src/api/feature-flags.ts) 支持相同的 `environmentName` 与作用域选择逻辑，与 Web 行为一致。
- **优先级**：P0

---

## 5. 非功能需求

| ID | 描述 | 优先级 |
|----|------|--------|
| NFR-ENVFLAG-001 | 迁移对现有生产数据零破坏：新列默认 `NULL`；迁移顺序为先加列与外键，再调整唯一索引 | P0 |
| NFR-ENVFLAG-002 | 不在日志中输出 `valueJson` 中的敏感内容（延续现有实践） | P0 |
| NFR-ENVFLAG-003 | 单元测试覆盖：三作用域 list、环境级重复 key、非法 `environmentName` 组合 | P0 |

---

## 6. 验收检查清单（实现对照）

- [ ] 组织级、项目级、环境级列表互不串数据。
- [ ] 同一环境下重复 `key` 创建被拒绝（409 或 DB 约束 + 应用层 409）。
- [ ] 仅 `environmentName` 无 `projectSlug` → 400。
- [ ] 删除环境后，其环境级 `FeatureFlag` 行被级联删除（或等价无孤儿行）。
- [ ] 环境改名后，用 **新** `environmentName` 可列出原数据（`environmentId` 不变）。
- [ ] Web、MP 均可切换作用域并完成 CRUD。
- [ ] [README.md](../../README.md)、[README-EN.md](../../README-EN.md) 已更新特性开关说明。

---

## 7. 代码锚点（实现入口）

| 区域 | 路径 |
|------|------|
| Prisma | [apps/server/prisma/schema.prisma](../../apps/server/prisma/schema.prisma) |
| 既有部分唯一迁移（待新迁移调整） | [apps/server/prisma/migrations/20260411220000_feature_flag_partial_unique/migration.sql](../../apps/server/prisma/migrations/20260411220000_feature_flag_partial_unique/migration.sql) |
| 应用服务 | [apps/server/src/modules/feature-flags/application/feature-flags.application.service.ts](../../apps/server/src/modules/feature-flags/application/feature-flags.application.service.ts) |
| 控制器 | [apps/server/src/modules/feature-flags/feature-flags.controller.ts](../../apps/server/src/modules/feature-flags/feature-flags.controller.ts) |
| Web API | [apps/web/src/api/feature-flags/index.ts](../../apps/web/src/api/feature-flags/index.ts) |
| Web UI | [ProjectDetailPage.vue](../../apps/web/src/pages/projects/ProjectDetailPage.vue)、[ProjectFeatureFlagsPanel.vue](../../apps/web/src/pages/projects/components/ProjectFeatureFlagsPanel.vue) |
| MP | [apps/mp/src/api/feature-flags.ts](../../apps/mp/src/api/feature-flags.ts)、[ProjectFeatureFlagsTab.vue](../../apps/mp/src/package-org/components/ProjectFeatureFlagsTab.vue) |

---

## 8. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-12 | 初稿：与 [shipyard-环境特性开关.plan.md](./shipyard-环境特性开关.plan.md) 对齐 |
