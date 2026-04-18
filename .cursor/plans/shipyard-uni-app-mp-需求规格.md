# Shipyard 管理端（uni-app 小程序）需求规格说明书

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 产品代号 | **MP**（Mini Program，仓库内包名建议 `@shipyard/mp`） |
| 基线 | 与现有 Web 管理端 [apps/web](../../apps/web) **功能与信息架构全量对齐**（以 [apps/web/src/router/index.ts](../../apps/web/src/router/index.ts) 为准） |
| 后端基线 | 现有 Shipyard **Nest API**，**不强制**为本需求单独改版；仅当小程序无法使用 Socket 等能力时，可另立「后端增强」子需求 |
| 关联路线图 | [.cursor/plans/shipyard-uni-app-mp-路线图.plan.md](./shipyard-uni-app-mp-路线图.plan.md) |
| 读者 | 产品 / 前端 / 测试 / 运维 / Agent 实现参考 |

---

## 1. 背景与目标

### 1.1 背景

Shipyard 管理后台当前以 **Web（Vue 3 + Vite）** 交付，部署与研发运维人员需在移动端查看组织、项目、部署状态与日志。微信小程序等平台要求使用 **原生或跨端小程序** 形态访问；本需求在 monorepo 内新增 **uni-app（Vue 3 + Vite + TypeScript）** 子应用，**复用同一套后端 API 与鉴权模型**，在合规与平台能力约束下尽可能 **1:1 对齐 Web 功能**。

### 1.2 目标（一句话）

交付可上架（或至少可稳定体验版）的 **Shipyard 管理端小程序**，在 **邮箱密码 + JWT** 与 Web 一致的前提下，覆盖 Web 路由中的 **全部业务模块**；布局与交互允许按小程序规范调整，**字段、操作、接口语义与 Web 对齐**。

### 1.3 成功标准（版本级）

- 微信小程序可完成：**登录 → 选组织 → 浏览仪表盘 → 项目/环境/部署详情 →** 各治理模块（服务器、团队、审批、Git 账户、组织/个人设置）的 **核心路径无阻塞**。
- **鉴权**：Token 过期可刷新；登出后无法访问需登录页；未登录访问业务页应回到登录并支持回跳意图（与 Web 一致或可接受的等价实现）。
- **网络**：在配置 **HTTPS API 域名** 与微信后台 **合法域名** 后，主流程请求无「未配置域名」类失败。
- 仓库内 **文档**：根目录 [README.md](../../README.md) 含小程序 **构建、域名、合规提示**；若引入后端新接口（如日志轮询），[CHANGELOG.md](../../CHANGELOG.md) 与必要时 ADR 有记录。

---

## 2. 范围与优先级摘要

### 2.1 范围内（必须交付）

| 优先级 | 内容 |
|--------|------|
| **P0** | 工程接入 monorepo；`uni.request`（或经评审的等价方案）+ JWT / Refresh 队列；认证四页；组织列表与组织上下文；**分包**与主包体积可控 |
| **P0** | 组织内：**仪表盘**、**项目**（列表/新建/详情）、**环境**、**部署详情**（含日志展示方案定案后的实现） |
| **P1** | **服务器**、**团队**、**审批**、**Git 账户**、**组织设置**、**个人设置** |
| **P1** | 国际化（与 Web 语言项对齐或可配置子集）、根目录 `dev:mp` / `build:mp-weixin` 脚本 |
| **P2** | 暗色主题与 Web 对齐（若 Web 持续提供）；`tabBar` 固定入口（仅子集模块）；CI 自动上传微信（miniprogram-ci） |

### 2.2 范围外（Out of Scope）

- **微信一键登录 / 手机号授权登录**（首版不做；若未来要做，单独立项）。
- 与 Shipyard **业务无关**的微信能力：订阅消息、广告、直播等（除非产品另发需求）。
- **完全像素级**复刻 Web UI（Naive UI 组件在小程序侧不可用，允许用 Wot Design Uni 等实现 **信息等价**）。
- Web 端 **xterm 终端** 在小程序中的 **等价交互**（以只读日志列表替代，见 FR-MP-DEPLOY）。

### 2.3 平台范围

- **首版主目标**：**微信小程序**（`mp-weixin`）。
- **其它端**（支付宝、App 等）：通过 uni-app 条件编译 **逐步打开**，本规格以微信能力为验收主绳；若某端缺失 API，允许降级说明写在页面或 README。

---

## 3. 术语

| 术语 | 含义 |
|------|------|
| MP | 本小程序客户端工程，目录建议 `apps/mp`，包名 `@shipyard/mp` |
| 全量对齐 | 与 Web **路由级**功能一一存在入口；核心 CRUD/状态与 Web **同一后端语义**；允许 **布局/组件形态**不同 |
| 防腐层 | `apps/mp` 下 `api/*` 模块，DTO → 视图模型映射，页面不直接拼 URL |
| 合法域名 | 微信公众平台配置的 request / socket 等域名白名单 |
| 组织上下文 | 当前选中的 `orgSlug`，与 Web `stores/org` 语义一致 |

---

## 4. 功能需求

### 4.1 工程与仓库（FR-MP-ENG）

**FR-MP-ENG-001 monorepo 集成**

- **描述**：`apps/mp` 纳入 [pnpm-workspace.yaml](../../pnpm-workspace.yaml)；可 `pnpm --filter @shipyard/mp` 安装与构建；Node/pnpm 版本与仓库约定一致或文档说明差异。
- **优先级**：P0

**FR-MP-ENG-002 根目录脚本**

- **描述**：仓库根 [package.json](../../package.json) 提供 `dev:mp`、`build:mp-weixin`（或等价命名），转发到子包脚本。
- **优先级**：P1

**FR-MP-ENG-003 技术栈锁定**

- **描述**：Vue 3 + Vite + TypeScript + Pinia + `@tanstack/vue-query`；UI **Wot Design Uni**；样式 **UnoCSS + unocss-applet**（与常见 uni-app 实践一致）。架构分层遵循仓库 [.cursor/skills/ddd-frontend/SKILL.md](../skills/ddd-frontend/SKILL.md)（页面 → composables → `api/*`）。
- **优先级**：P0

**FR-MP-ENG-004 双端 API 维护策略**

- **描述**：**短期** `apps/web/src/api` 与 `apps/mp` 下 **各维护一套** HTTP 模块，**目录与文件命名镜像**；**中期**可抽 `packages/api-client` 或 OpenAPI 生成，非本需求验收阻塞。
- **优先级**：P0（策略说明）/ P2（抽取实现）

**FR-MP-ENG-005 配置安全**

- **描述**：构建产物中 **不得** 嵌入生产环境密钥；仅 **构建期** 注入如 API Base URL 等非敏感配置；敏感凭据仅来自用户登录后的 JWT 与后端响应。
- **优先级**：P0

---

### 4.2 网络与运行环境（FR-MP-NET）

**FR-MP-NET-001 HTTPS 与域名**

- **描述**：所有正式环境 API 请求使用 **HTTPS**；WebSocket 使用 **WSS**。小程序后台须配置 **request 合法域名**；若使用实时日志连接，须配置 **socket 合法域名**（若平台分项配置）。
- **优先级**：P0

**FR-MP-NET-002 与 CORS 的关系**

- **描述**：小程序侧 **不依赖** 浏览器 CORS；能否访问由 **微信平台域名校验** 决定。后端仍应保持既有 CORS/安全策略，便于 Web 与同域工具链。
- **优先级**：P0（文档与认知对齐）

**FR-MP-NET-003 Base URL**

- **描述**：禁止沿用 Web 开发态的相对路径 `baseURL: '/api'`；必须通过环境变量（如 `VITE_API_BASE`）配置完整 API 前缀（含 `/api` 路径约定与 Web 一致）。
- **优先级**：P0

---

### 4.3 鉴权与账号（FR-MP-AUTH）

**FR-MP-AUTH-001 登录方式**

- **描述**：首版仅支持 **邮箱 + 密码** 注册/登录/忘记密码/重置密码，与 Web 四路由行为对齐；**不做**微信 OpenID 一键登录。
- **优先级**：P0

**FR-MP-AUTH-002 Token 存储**

- **描述**：`accessToken`、`refreshToken` 存于小程序存储（如 `uni.setStorageSync`）；抽象 `storage` 访问层，便于单测与替换。
- **优先级**：P0

**FR-MP-AUTH-003 请求携带与刷新**

- **描述**：请求头携带 `Authorization: Bearer <accessToken>`；遇 401 时 **刷新队列** 行为与 Web [apps/web/src/api/client.ts](../../apps/web/src/api/client.ts)、[apps/web/src/stores/auth.ts](../../apps/web/src/stores/auth.ts) **语义对齐**（避免并发风暴）。无 Cookie 依赖。
- **优先级**：P0

**FR-MP-AUTH-004 路由守卫**

- **描述**：未登录访问需登录页面时，跳转登录页；登录成功后应能回到原目标或等价体验（与 Web `redirect` query 对齐或可说明差异）。
- **优先级**：P0

**FR-MP-AUTH-005 登出**

- **描述**：清除本地 token 与相关缓存；服务端若有无状态 JWT 则与 Web 登出语义一致。
- **优先级**：P0

---

### 4.4 导航与信息架构（FR-MP-NAV）

**FR-MP-NAV-001 与 Web 路由对应**

- **描述**：以下 Web 路径在小程序中均有可达入口（`pages.json` + 分包），路径参数 **`orgSlug`、`projectSlug`、`deploymentId`** 语义一致：

| Web | 小程序（示例，实现可调整路径字符串） |
|-----|--------------------------------------|
| `/login`、`/register`、`/forgot-password`、`/reset-password` | 主包 `pages/auth/*` |
| `/settings`（个人） | 分包，如 `packageSettings` |
| `/orgs` | 主包或分包 `pages/orgs/list` |
| `/orgs/:orgSlug` | 组织首页（仪表盘） |
| `.../projects`、`.../projects/new`、`.../projects/:projectSlug` | 项目列表/新建/详情 |
| `.../environments` | 环境 |
| `.../deployments/:deploymentId` | 部署详情 |
| `.../servers`、`.../team`、`.../approvals`、`.../git-accounts` | 同 Web |
| `.../settings`（组织） | 组织设置 |

- **优先级**：P0（认证+组织+项目+部署）/ P1（其余模块）

**FR-MP-NAV-002 默认导航形态**

- **描述**：以 **页面栈 + 自定义导航栏**（标题 + 返回）为主，对齐 Web [AppLayout](../../apps/web/src/components/layout/AppLayout.vue) 的「顶栏 + 内容」；**首版不强制** `tabBar`；若后续增加，仅对 **仪表盘/项目/审批** 等子集开放，并在路线图注明。
- **优先级**：P0

**FR-MP-NAV-003 组织上下文**

- **描述**：Pinia 维护 `currentOrgSlug`（或等价），进入组织分包页前校验；与 Web [stores/org](../../apps/web/src/stores/org.ts) 语义一致。
- **优先级**：P0

**FR-MP-NAV-004 分包与体积**

- **描述**：使用 **主包 + 分包**（如组织分包 `packageOrg`、个人设置分包等）；主包大小满足微信小程序限制；大组件按需加载。
- **优先级**：P0

---

### 4.5 组织与个人（FR-MP-ORG）

**FR-MP-ORG-001 组织列表**

- **描述**：展示用户所属组织，可选中进入组织上下文；行为与 Web 组织列表页对齐。
- **优先级**：P0

**FR-MP-ORG-002 仪表盘**

- **描述**：组织首页数据与 Web 仪表盘 **同源 API**；图表使用小程序兼容方案（如 lime-echart），**指标含义**与 Web 一致。
- **优先级**：P0

**FR-MP-ORG-003 个人设置**

- **描述**：与 Web 个人设置页 **字段与保存接口** 对齐（头像/昵称/密码等以 Web 当前能力为准）。
- **优先级**：P1

**FR-MP-ORG-004 组织设置**

- **描述**：与 Web 组织设置对齐（含 FeatureFlag、通知、Release 相关配置等 Web 已暴露项）；复杂表单可用分步或折叠卡片。
- **优先级**：P1

---

### 4.6 项目与环境（FR-MP-PROJECT）

**FR-MP-PROJECT-001 项目列表与新建**

- **描述**：列表、筛选/排序行为与 Web 对齐；新建项目字段与校验与 Web 对齐。
- **优先级**：P0

**FR-MP-PROJECT-002 项目详情**

- **描述**：展示 Web 详情页核心区块（流水线、通知、特性开关等 Tab 或纵向区块）；**禁止**遗漏 Web 已提供的 **高危操作** 若无产品明确删减说明。
- **优先级**：P0

**FR-MP-PROJECT-003 环境管理**

- **描述**：环境列表、创建/编辑/删除（若 Web 支持）与 releaseConfig 等配置入口与 Web 对齐；弹窗在小程序侧用 `Popup`/`Page` 二级页实现均可。
- **优先级**：P0

---

### 4.7 部署与流水线（FR-MP-DEPLOY）

**FR-MP-DEPLOY-001 部署详情信息**

- **描述**：部署状态、分支、commit、耗时、环境、触发方式、流程阶段等与 Web [DeploymentDetailPage](../../apps/web/src/pages/pipeline/DeploymentDetailPage.vue) **信息等价**。
- **优先级**：P0

**FR-MP-DEPLOY-002 日志实时性（定案项）**

- **描述**：在 **PR4/实现前** 必须完成 **PoC** 并写入实现说明：  
  - **方案 A**：继续使用 **socket.io** 客户端连接现有服务（`wss` + 合法域名 + 鉴权与 Web 一致）；或  
  - **方案 B**：新增后端 **轮询 / 纯 WebSocket / SSE** 等小程序友好接口（需 CHANGELOG + 可选 ADR）。  
  选定后，小程序侧须 **稳定展示增量日志**；失败时有可理解错误提示。
- **优先级**：P0

**FR-MP-DEPLOY-003 终端能力**

- **描述**：**不提供**与 Web xterm 等价的完整终端；以 **只读日志列表**（虚拟列表、自动滚动到底）满足排障；验收不考核交互式 shell。
- **优先级**：P0

**FR-MP-DEPLOY-004 重试与操作**

- **描述**：Web 上针对失败部署提供的 **重试** 等操作，小程序须同等提供（若受权限限制则与 Web 一致隐藏）。
- **优先级**：P0

---

### 4.8 基础设施与治理（FR-MP-OPS）

**FR-MP-OPS-001 服务器**

- **描述**：列表、添加、编辑、删除（以 Web 为准）；SSH 密钥等敏感项 **不明文常驻界面**；表格可改为卡片列表。
- **优先级**：P1

**FR-MP-OPS-002 团队**

- **描述**：成员与角色与 Web 对齐。
- **优先级**：P1

**FR-MP-OPS-003 审批**

- **描述**：待办列表与处理动作与 Web 对齐。
- **优先级**：P1

**FR-MP-OPS-004 Git 账户**

- **描述**：连接列表与 CRUD 与 Web 对齐；Token 等字段掩码显示与 Web 一致。
- **优先级**：P1

**FR-MP-OPS-005 Kubernetes 集群（若 Web 已暴露）**

- **描述**：与 Web 组织设置/相关页对齐；无 Web 入口则本项不适用。
- **优先级**：P2

---

### 4.9 国际化与可访问（FR-MP-I18N）

**FR-MP-I18N-001 语言资源**

- **描述**：使用 `vue-i18n`；文案可与 [apps/web/src/i18n/messages](../../apps/web/src/i18n/messages) **阶段性复制**后合并，关键路径（登录、部署状态、错误）**不得**硬编码中文漏翻（至少支持 zh-CN，与 Web 默认一致）。
- **优先级**：P1

---

### 4.10 文档与发布（FR-MP-DOC）

**FR-MP-DOC-001 README**

- **描述**：说明：构建命令、环境变量、`mp-weixin` AppID 配置位置、**合法域名**、体验版流程、**类目与隐私政策/用户数据处理说明** 指引。
- **优先级**：P0

**FR-MP-DOC-002 变更记录**

- **描述**：首次合入或发版时更新 [CHANGELOG.md](../../CHANGELOG.md)；后端接口变更按仓库规范处理。
- **优先级**：P1

**FR-MP-DOC-003 CI（可选）**

- **描述**：miniprogram-ci 自动上传为 **P2**；文档中说明密钥与责任边界。
- **优先级**：P2

---

### 4.11 多机与蓝绿（说明性）

**FR-MP-NOTE-001**

- **描述**：Web 上关于「多机仅入口机蓝绿」等行为由 **后端与部署策略** 决定；小程序 **仅展示 API 返回结果** 与可操作按钮，不新增服务端语义。
- **优先级**：说明项

---

## 5. 非功能需求

| ID | 类别 | 要求 |
|----|------|------|
| NFR-MP-001 | 性能 | 首屏与常用列表在 4G 网络下可接受；长列表使用虚拟列表或分页；避免单页一次性注入超大 JSON |
| NFR-MP-002 | 稳定 | 请求超时、断网、401/403/5xx 有统一错误提示与可重试入口（与 Web 体验同级） |
| NFR-MP-003 | 安全 | Token 仅存本地存储；日志与错误上报不得打印完整 Token；HTTPS 证书校验遵循平台默认 |
| NFR-MP-004 | 兼容 | 微信基础库版本下限在 README 标明；条件编译隔离非微信端差异 |
| NFR-MP-005 | 可维护 | `api/*` 与 composables 可测；关键刷新/登录流建议保留 Vitest 或等价单测（与 Web 测试策略对齐即可） |

---

## 6. 数据与配置

- **服务端**：复用现有 Shipyard 数据库与 API，**本需求不强制**新表；若采用 FR-MP-DEPLOY-002 方案 B，以后端子需求为准补充迁移与文档。
- **客户端环境变量**：至少 `VITE_API_BASE`（或项目模板约定变量名，须在 README 统一）。
- **微信后台**：AppID、合法域名、（可选）服务端域名、隐私合规配置由运维/产品在发布前完成。

---

## 7. 风险与依赖

| 风险 | 缓解 |
|------|------|
| Socket / socket.io 在微信受限 | PR4 前 PoC；准备方案 B 与排期 |
| 分包体积超限 | 分包策略、按需引入、图表懒加载 |
| 审核与类目 | 提前选类目、准备隐私政策与用户协议链接 |
| Web 功能迭代快于 MP | 以路由+api 镜像约定跟进；中期共享 API 层 |

---

## 8. 验收标准汇总

| 域 | 验收要点 |
|----|----------|
| FR-MP-ENG | 可从仓库根脚本构建出 `mp-weixin` 产物；无密钥进包 |
| FR-MP-NET / AUTH | 配置域名后可登录并保持会话；401 刷新与登出符合预期 |
| FR-MP-NAV | 第 4.4 节表格中 **P0** 路径均可走通 |
| FR-MP-PROJECT | 项目与环境 CRUD 与 Web 同源语义 |
| FR-MP-DEPLOY | 部署详情信息完整；日志方案已 PoC 并落地；无 xterm 要求 |
| FR-MP-OPS（P1） | 服务器/团队/审批/Git/组织与个人设置核心流程可用 |
| FR-MP-DOC | README 含域名与合规提示 |

---

## 9. 里程碑（建议与路线图 PR 阶段一致）

| 阶段 | 重点 |
|------|------|
| M1 | FR-MP-ENG + FR-MP-NET + FR-MP-AUTH + 认证四页 |
| M2 | 组织列表、上下文、仪表盘、分包骨架 |
| M3 | 项目 + 环境 |
| M4 | 部署详情 + 日志方案定案与实现 |
| M5 | 服务器、团队、审批、Git、设置 |
| M6 | i18n、体积与体验优化、文档与（可选）CI |

---

## 10. 文档存放约定（仓库内）

- **计划与需求**统一放在本仓库 **[.cursor/plans](./)**，**不**将仅属于本项目的路线图/需求放到全局 `~/.cursor/plans`。
- 本需求关联路线图：[shipyard-uni-app-mp-路线图.plan.md](./shipyard-uni-app-mp-路线图.plan.md)。

---

## 11. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-11 | 1.0 | 初稿：全量对齐 Web 路由；含网络/鉴权/日志定案/分包/合规 |
