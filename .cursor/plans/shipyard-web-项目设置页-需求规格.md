# Shipyard Web：项目设置页 — 需求规格说明书

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 类型 | 专题需求（非整版本号发布） |
| 关联实施计划 | [.cursor/plans/shipyard-web-项目设置页.plan.md](./shipyard-web-项目设置页.plan.md) |
| 读者 | 产品/前端研发/测试、Agent 实现与验收 |

---

## 1. 背景与问题

### 1.1 背景

管理后台 [ProjectDetailPage.vue](../../apps/web/src/pages/projects/ProjectDetailPage.vue) 提供「设置」按钮，目标 URL 为 ``/orgs/:orgSlug/projects/:projectSlug/settings``，但 [router/index.ts](../../apps/web/src/router/index.ts) **未注册**该子路由。未匹配请求落入通配符重定向至 `/orgs`，用户误以为进入组织相关页面，体验错误。

### 1.2 目标（一句话）

提供**独立的项目设置页**与正确路由，承载与项目相关的可编辑配置（与现有后端 API 一致），并与详情页「编辑」、组织设置、详情 Tab 的职责边界清晰。

### 1.3 成功标准

- 从项目详情进入「设置」后，停留在**项目设置页**，URL 含 `projects/:projectSlug/settings`，不落到组织列表。
- 配置项与保存行为与当前 [ProjectDetailPage](../../apps/web/src/pages/projects/ProjectDetailPage.vue) 中 `saveProject` **等价**（推荐共用 composable，见关联计划 §5.1、§8）。
- UI 符合 [shipyard-ui-spec 模板 C](../skills/shipyard-ui-spec/PAGE-TEMPLATES.md)（设置页分区 Card、危险操作单独确认）。

---

## 2. 范围与优先级

| 级别 | 内容 |
|------|------|
| **P0** | 注册路由；新增 `ProjectSettingsPage`；§3 所列功能需求在 Web 端可完成保存与展示；修复错误跳转 |
| **P1** | 表单子组件 + `useProjectSettingsSave`（或等价）与 `ProjectEditModal` 共用；概览 Tab 构建变量改为摘要 + 跳转设置（与计划书一致） |
| **Stretch** | 收敛为仅设置页单一编辑入口；微信小程序对齐（另立专题） |

### 2.1 Out of Scope

- 新增后端字段或变更 `UpdateProjectPayload` / `UpdatePipelineConfigPayload` 语义（本需求以前端信息架构与页面为主）。
- 在设置页增加**第三处**编辑「通知文案模板」（`notificationMessageTemplate`）；仍以详情 Tab「通知」为主入口。
- 组织级 Kubernetes 集群、组织级特性开关、组织名称/配额等（归属 [OrgSettingsPage](../../apps/web/src/pages/settings/OrgSettingsPage.vue)）。

---

## 3. 功能需求

### FR-PROJ-SETTINGS-001 路由与导航

- **描述**：在 `orgs/:orgSlug` 子路由下增加 `projects/:projectSlug/settings`，且注册顺序**早于** `projects/:projectSlug`，避免被错误匹配。
- **优先级**：P0
- **验收**：直接访问或通过详情「设置」进入，页面标题/上下文均为当前项目。

### FR-PROJ-SETTINGS-002 基本信息

- **描述**：可编辑项目名称、URL slug、框架类型（`static` / `ssr`）；slug 校验与改 slug 后的路由替换行为与现有 `saveProject` 一致。
- **优先级**：P0
- **API**：`PATCH /orgs/:org/projects/:slug` 对应字段（见 [projects/index.ts](../../apps/web/src/api/projects/index.ts) `UpdateProjectPayload`）。

### FR-PROJ-SETTINGS-003 只读摘要

- **描述**：展示仓库全名、Git 连接等创建后不可在此页修改的信息（只读 Card），与详情概览一致；不提供修改入口。
- **优先级**：P0

### FR-PROJ-SETTINGS-004 流水线与构建

- **描述**：可编辑安装/构建命令、输出目录、Node 版本、lint/test、超时、依赖缓存、SSR 入口、预览健康路径；条件展示与校验与现 Modal 一致。
- **优先级**：P0
- **API**：`PATCH .../pipeline-config`（`UpdatePipelineConfigPayload`）。

### FR-PROJ-SETTINGS-005 容器镜像（Kubernetes）

- **描述**：可编辑构建后推送镜像开关、镜像名、Registry 用户名/密码；密码留空保留已有凭据的语义不变。
- **优先级**：P0
- **API**：同上 `pipeline-config`。

### FR-PROJ-SETTINGS-006 PR 预览（GitHub）

- **描述**：可编辑启用开关、预览服务器、预览父域；**仅**在当前产品已支持 PR 预览的场景展示该 Card（例如 `gitProvider === 'github'`）。
- **优先级**：P0
- **API**：`PATCH .../projects/:slug` 预览相关字段。

### FR-PROJ-SETTINGS-007 项目级构建环境变量

- **描述**：在设置页提供列表查看、添加、删除（与现有 build-env API 一致）。首版以设置页为**主入口**；概览 Tab 缩为摘要 + 跳转链接（P1，与计划书 §2.5 一致）。
- **优先级**：P0（设置页内 CRUD）；P1（概览收敛）
- **API**：`GET/POST/DELETE .../build-env`。

### FR-PROJ-SETTINGS-008 危险操作

- **描述**：移除项目须独立 Card、二次确认；可与详情页「移除」并存，文案统一。
- **优先级**：P0
- **API**：`DELETE .../projects/:slug`。

### FR-PROJ-SETTINGS-009 保存编排一致性

- **描述**：保存须与 `saveProject` 等价：先 `updateProject(slugBefore)`，再（若存在 pipelineConfig）`updatePipelineConfig(slugAfter)`；Registry 密码仅非空时提交；slug 变更后 `replace` 路由并失效相关 query。
- **优先级**：P1（与 P0 页面同时交付时**强烈建议**同一 composable，否则易回归）
- **锚点**：`ProjectDetailPage.vue` 内 `saveProject`。

### FR-PROJ-SETTINGS-010 双入口（首版）

- **描述**：保留详情「编辑」打开 Modal 与「设置」全页**并存**；按钮/文案区分「快速编辑」与「项目设置」。
- **优先级**：P0

---

## 4. 非功能需求

| ID | 描述 |
|----|------|
| NFR-001 | 遵循 [shipyard-ui-spec](../skills/shipyard-ui-spec/SKILL.md) 与模板 C：分区 Card、`NForm`、危险操作隔离。 |
| NFR-002 | 不引入与现有详情页矛盾的校验规则；共用逻辑保证 Modal 与设置页行为一致。 |
| NFR-003 | 错误提示与现项目详情/编辑流程一致（同一校验消息来源更佳）。 |

---

## 5. 验收检查清单（测试可对照）

- [ ] 详情「设置」→ URL 为 `/orgs/:org/projects/:project/settings` 且页面为项目设置。
- [ ] 未匹配路径不再因本功能误伤；组织设置仍为 `/orgs/:org/settings`。
- [ ] §3 各 FR 字段保存后，刷新或返回详情，数据与后端一致。
- [ ] 非 GitHub 项目不展示 PR 预览配置块（或等价产品规则）。
- [ ] 删除项目二次确认生效。
- [ ] （P1）概览构建变量仅为摘要 + 链到设置页；保存逻辑与 `saveProject` 共用。

---

## 6. 代码锚点（实现检索）

| 区域 | 路径 |
|------|------|
| 路由 | [apps/web/src/router/index.ts](../../apps/web/src/router/index.ts) |
| 详情与保存参考 | [apps/web/src/pages/projects/ProjectDetailPage.vue](../../apps/web/src/pages/projects/ProjectDetailPage.vue) |
| 编辑表单参考 | [apps/web/src/pages/projects/components/ProjectEditModal.vue](../../apps/web/src/pages/projects/components/ProjectEditModal.vue) |
| API | [apps/web/src/api/projects/index.ts](../../apps/web/src/api/projects/index.ts) |
| 组织设置（边界对照） | [apps/web/src/pages/settings/OrgSettingsPage.vue](../../apps/web/src/pages/settings/OrgSettingsPage.vue) |

---

## 7. 关联文档

- 实施细化、配置清单表、风险表：[shipyard-web-项目设置页.plan.md](./shipyard-web-项目设置页.plan.md)
