# Shipyard Web：项目设置页（修复错误跳转 + 配置清单）

| 项 | 内容 |
|----|------|
| 文档版本 | 1.2 |
| 关联需求规格 | [.cursor/plans/shipyard-web-项目设置页-需求规格.md](./shipyard-web-项目设置页-需求规格.md)（验收以需求规格 §5 为准） |
| 关联审阅 | 根因：`projects/:projectSlug/settings` 未注册 → 通配符重定向 `/orgs`；与 [shipyard-ui-spec 模板 C](../skills/shipyard-ui-spec/PAGE-TEMPLATES.md)「项目设置」对齐 |

---

## 1. 背景与目标

- [apps/web/src/pages/projects/ProjectDetailPage.vue](../../apps/web/src/pages/projects/ProjectDetailPage.vue)「设置」指向 `` `/orgs/:orgSlug/projects/:projectSlug/settings` ``，但 [apps/web/src/router/index.ts](../../apps/web/src/router/index.ts) 无该子路由，用户被送到组织列表。
- 新增 **`ProjectSettingsPage`** 并注册路由；页面承载的**项目级配置**以下文「配置清单」为准（与现有后端 API 一一对应，避免凭空加字段）。

---

## 2. 项目设置页：计划在 UI 上提供的配置块（清单）

下列为**当前产品能力下**计划在「项目设置」中分区展示或可跳转的内容。保存时调用与今日 [ProjectEditModal](../../apps/web/src/pages/projects/components/ProjectEditModal.vue) 相同的接口组合（`updateProject` + `updatePipelineConfig`），构建变量走独立 REST。

### 2.1 基本信息（`PATCH .../projects/:slug` 部分字段）

| 配置项 | 说明 | API 字段 |
|--------|------|----------|
| 项目名称 | 展示名 | `name` |
| URL 标识（slug） | 改 slug 后路由变化，需校验与二次确认策略与现有一致 | `slug` |
| 框架类型 | `static` / `ssr` | `frameworkType` |

**只读、不设表单（创建后固定）**：仓库 `repoFullName`、Git 账户绑定关系等——与详情概览一致，设置页可放「只读摘要」卡片，不提供修改（除非未来单独 FR）。

### 2.2 流水线 / 构建（`PATCH .../pipeline-config`）

| 配置项 | 说明 | API 字段 |
|--------|------|----------|
| 安装命令 | 如 pnpm install | `installCommand` |
| 构建命令 | 如 pnpm build | `buildCommand` |
| 输出目录 | 如 dist | `outputDir` |
| Node 版本 | 可选值与现 Modal 一致 | `nodeVersion` |
| Lint 命令 | 可选 | `lintCommand` |
| 测试命令 | 可选 | `testCommand` |
| 构建超时（秒） | 上下限与现有一致 | `timeoutSeconds` |
| 依赖缓存开关 | | `cacheEnabled` |
| SSR 入口 | 仅 `frameworkType === 'ssr'` 时展示 | `ssrEntryPoint` |
| 预览健康路径 | PR 预览 SSR 蓝绿前 curl 路径；空等同 `/` | `previewHealthCheckPath` |

### 2.3 容器镜像（Kubernetes）（`PATCH .../pipeline-config`）

| 配置项 | 说明 | API 字段 |
|--------|------|----------|
| 构建后推送镜像 | 开关 | `containerImageEnabled` |
| 镜像名（无 tag） | 启用时必填 | `containerImageName` |
| Registry 用户名 / 密码 | 密码「留空保留」语义与 Modal 一致 | `containerRegistryAuth` |

### 2.4 PR 预览（GitHub）（`PATCH .../projects/:slug`）

| 配置项 | 说明 | API 字段 |
|--------|------|----------|
| 启用 PR 预览 | | `previewEnabled` |
| 预览服务器 | SSH Linux 服务器下拉 | `previewServerId` |
| 预览父域 | 泛解析说明与现 Tooltip 一致 | `previewBaseDomain` |

**展示条件（与现详情一致）**：整块 PR 预览表单仅在当前产品已支持的场景下展示（例如 `gitProvider === 'github'`），非支持平台不铺开该 Card，避免误导。

> 与流水线中的 `previewHealthCheckPath` 配合使用（SSR 场景）。

### 2.5 构建环境变量（项目级）（独立资源）

| 配置项 | 说明 | API |
|--------|------|-----|
| KEY/VALUE 列表 | 构建阶段使用；环境级覆盖同名项 | `GET/POST/DELETE .../build-env` |

**首版建议**：设置页**纳入**该块（表格 + 增删），概览 Tab 保留简短摘要 + 「前往项目设置」链接，避免「两处都是主入口」。

### 2.6 危险操作

| 操作 | API |
|------|-----|
| 移除项目 | `DELETE .../projects/:slug` |

与详情页「移除」二选一或两处并存（文案统一）；须二次确认，符合模板 C。

---

## 3. 明确不在「项目设置页」主表单内的能力（避免重复主入口）

以下仍属**项目域**，但计划在**详情 Tab 或其它路由**保持主交互；设置页如需仅做「快捷链接」可链到 `?tab=...`，**不把大块表单拆成第三份**。

| 能力 | 当前位置 | 说明 |
|------|----------|------|
| 部署通知渠道、规则等 | 详情 Tab「通知」— [ProjectNotificationsPanel](../../apps/web/src/pages/projects/components/ProjectNotificationsPanel.vue) | 内含 `notificationMessageTemplate`，已通过 `updateProject` 保存；**不设第三处编辑框**，设置页可文案引导至通知 Tab |
| 项目级特性开关 | 详情 Tab「特性」— [ProjectFeatureFlagsPanel](../../apps/web/src/pages/projects/components/ProjectFeatureFlagsPanel.vue) | 独立 API，非 `updateProject` |
| 环境 CRUD、release 配置 | [EnvironmentsPage](../../apps/web/src/pages/environments/EnvironmentsPage.vue) | 「环境管理」入口已存在 |
| 部署历史 / 触发部署 | 详情 Tab「部署历史」、概览卡片 | 运维流，非「设置」 |

---

## 4. 与「组织设置」边界（不得纳入项目设置）

- Kubernetes **集群登记**（组织级资源）
- **组织级**特性开关、组织名称/slug、并行构建数、产物保留数  

见 [OrgSettingsPage.vue](../../apps/web/src/pages/settings/OrgSettingsPage.vue)。

---

## 5. 实现要点（摘要）

1. 路由：注册 `projects/:projectSlug/settings`，顺序在 `projects/:projectSlug` 之前。
2. 表单：抽取与 `ProjectEditModal` 共用的表单子组件（或同 composable），**单一保存路径**，避免字段漂移（见 §8）。
3. **编辑入口策略（首版锁定）**：保留详情「编辑」打开 Modal **与**「设置」进入全页**并存**，文案区分（「快速编辑」vs「项目设置」）；后续可再收敛。
4. 小程序：不强制与本版同步；路线图注明 Web 先行即可。

### 5.1 保存编排（与现逻辑对齐，防回归）

- 与 [ProjectDetailPage.vue](../../apps/web/src/pages/projects/ProjectDetailPage.vue) 中 **`saveProject`** 一致：
  1. 先做表单校验（slug、必填流水线字段、预览启用时的服务器与父域、超时等）。
  2. **`updateProject`**（`slugBefore`）写入名称、slug、框架、PR 预览相关字段。
  3. 若存在 `pipelineConfig`，再 **`updatePipelineConfig`**（`slugAfter`，即可能已变更的 slug）写入流水线与容器镜像字段；Registry 密码仅非空时附带 `containerRegistryAuth`。
  4. slug 变更时：`router.replace` 到新项目路径并 `invalidateQueries` / `refetch`，与 Modal 保存后行为一致。
- **推荐**：将「校验 + 两次 PATCH + slug 迁移 + 失效查询」抽成 **composable**（如 `useProjectSettingsSave`），Modal 与 `ProjectSettingsPage` 共用，避免设置页另写一套顺序或错误处理。

---

## 6. 验收

- 详情「设置」进入项目设置页，URL 正确，不再落到 `/orgs`。
- 上述 2.1–2.6 与现有 API 行为一致；2.3 节与组织设置无交叉。
- 保存结果与 **`saveProject` 等价**（推荐通过 §5.1 composable 共用，满足 §8 风险缓解）。
- 通知文案模板仍只在通知 Tab 编辑（或计划变更需在本文档与界面同步更新）。

---

## 7. 关联

- UI 骨架：[PAGE-TEMPLATES.md](../skills/shipyard-ui-spec/PAGE-TEMPLATES.md) 模板 C
- 前端 API 类型：[apps/web/src/api/projects/index.ts](../../apps/web/src/api/projects/index.ts)（`UpdateProjectPayload`、`UpdatePipelineConfigPayload`、build-env）
- **保存参考实现**：[ProjectDetailPage.vue](../../apps/web/src/pages/projects/ProjectDetailPage.vue) 内 `saveProject`

### 7.1 可选（非必须）：与版本路线图互链

若需在版本规划中可追溯本需求，可在本目录下对应版本的 `*-路线图.plan.md`（如 [shipyard-v0.4-路线图.plan.md](./shipyard-v0.4-路线图.plan.md)）中增加一条指向本文档的引用；**不作为交付阻塞**。

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Modal 与设置页各维护一份表单，字段或校验漂移 | **必须**共用表单子组件或 composable；保存逻辑只保留一份（§5.1）。 |
| 仅实现设置页而未抽离 `saveProject`，复制粘贴导致 PATCH 顺序/条件（如 `pipelineConfig` 存在才 patch）不一致 | 实现前对照 `saveProject` 全文；抽 composable 后两处仅传 `orgSlug`/`projectSlug` 与表单快照。 |
| PR 预览在非 GitHub 项目展示 | 遵守 §2.4 展示条件。 |
