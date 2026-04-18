# Shipyard v0.4.0 需求规格说明书

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 对应版本 | **v0.4.0** |
| 基线版本 | **v0.3.0**（见仓库根 [CHANGELOG.md](../../CHANGELOG.md)） |
| 关联路线图 | [.cursor/plans/shipyard-v0.4-路线图.plan.md](./shipyard-v0.4-路线图.plan.md) |
| 读者 | 产品/研发/测试/运维、Agent 实现参考 |

---

## 1. 背景与目标

### 1.1 背景

v0.3.0 已交付：PR 预览 SSR 蓝绿、SSH `[precheck]`、飞书/Slack `secret`、按 lockfile 的 `node_modules` 缓存、`SHIPYARD_BUILD_USE_DOCKER` 占位告警。下一版需在 **可运营性**（缓存磁盘、Docker 真隔离）、**部署一致性**（Nginx 原子写、预览健康路径可配）、**通知覆盖面**（企业微信）上可验收；并与路线图中的 **P0/P1/Stretch** 一致。

### 1.2 版本目标（一句话）

在默认仍为「本机 `child_process` 构建」的前提下，提供 **可选 Docker 构建路径（Linux Worker）**、**可上限可淘汰的依赖缓存**、**预览与生产部署体验对齐**，并扩展 **企业微信** 与 **可验证的自托管文档**。

### 1.3 成功标准（版本级）

- P0 项在 Linux Worker + 默认关闭 Docker 的场景下均可回归通过（见第 8 节）。
- README 含 **Docker 不支持矩阵**；自托管矩阵含 **至少一条可点击链接或 issue 引用**。
- 行为变化与新增环境变量写入 [CHANGELOG.md](../../CHANGELOG.md) 与 [.env.example](../../.env.example)。

---

## 2. 范围与优先级摘要

### 2.1 与路线图对齐的优先级

| 级别 | 内容 |
|------|------|
| **P0** | Docker opt-in 在 Linux Worker 跑通全链路；缓存全局磁盘上限 + **默认 LRU 淘汰**（见 4.2）；预览 SSR 健康检查路径可配置；CHANGELOG / README / README-EN / Docker 矩阵 |
| **P1** | Linux 常规部署 Nginx 原子写；企业微信全链路（shared 枚举、API、Web、单测） |
| **Stretch** | 按组织缓存配额；`GIT_SMOKE_*` CI；纯 TTL 淘汰（若与 LRU 并存则文档说明优先级） |

### 2.2 Out of Scope

- 多区域 HA、审计、合规、1.0 商业就绪清单（延续 v0.3 边界）。
- Windows/macOS 上 Docker 构建（列入不支持矩阵即可，不要求实现）。

---

## 3. 术语

| 术语 | 含义 |
|------|------|
| Build 执行器 | 抽象 `install`/`build` 等命令的调度层：`Process` 或 `Docker` |
| 缓存条目 | 指 `SHIPYARD_BUILD_DEPS_CACHE_PATH` 下某一 `orgId/pm/fingerprint/node_modules` 树（或实现等价路径结构） |
| LRU（本版默认） | 缓存总占用超上限时，按条目目录 **mtime** 最旧优先删除，直至低于阈值 |
| 预览健康路径 | SSR 预览在切换 Nginx 前，远端 `curl` 使用的 HTTP 路径（含默认 `/`） |

---

## 4. 功能需求

### 4.1 Docker 构建执行（FR-DOCKER）

**FR-DOCKER-001 开关行为**

- **描述**：`SHIPYARD_BUILD_USE_DOCKER !== 'true'` 时，行为与 v0.3.0 完全一致（本机 `child_process`）。为 `true` 且宿主为 **Linux** 时，install/build 在容器内执行。
- **优先级**：P0

**FR-DOCKER-002 镜像与命令**

- **描述**：文档与代码约定基础镜像（Node 大版本与 v20+ 建议一致）、镜像 tag 固定或可配置 env；容器内工作目录与宿主编排目录一致，保证 `pipelineConfig` 命令语义不变。
- **优先级**：P0

**FR-DOCKER-003 卷与缓存**

- **描述**：源码（或 clone 目录）与构建 workdir 挂载策略须在 README 说明；**依赖缓存目录**与宿主 `SHIPYARD_BUILD_DEPS_CACHE_PATH` 的挂载只读/读写策略须避免双份拷贝且无权限陷阱（实现选型写入 CHANGELOG 或 ADR 摘要）。
- **优先级**：P0

**FR-DOCKER-004 产物写出**

- **描述**：构建生成的 tarball 或中间产物须出现在宿主 `ARTIFACT_STORE_PATH` 约定路径，权限可供后续部署流程读取。
- **优先级**：P0

**FR-DOCKER-005 不支持矩阵**

- **描述**：非 Linux Worker 或缺少 Docker CLI/daemon 时，应 **明确失败日志** 并指引关闭开关或换宿主；不得静默回退除非文档明确「可选回退」且打 warn。
- **优先级**：P0

**FR-DOCKER-006 资源与安全（Stretch）**

- **描述**：CPU/内存上限、`--network` 策略、非 `--privileged` 默认；可在 P0 先满足「能跑」，在 0.4.x 收紧。
- **优先级**：P2

---

### 4.2 构建缓存运营（FR-CACHE）

**FR-CACHE-001 全局磁盘上限**

- **描述**：新增环境变量（如 `SHIPYARD_BUILD_DEPS_CACHE_MAX_BYTES` 或 `…_MAX_MB`），超过则触发淘汰。未配置时采用文档约定的 **默认上限**（或「不限制仅 warn」须在评审中否决——本规格建议 **必须有默认上限**）。
- **优先级**：P0

**FR-CACHE-002 淘汰策略（已锁定默认）**

- **描述**：**默认 LRU**：按各缓存条目根目录（或代表文件）**mtime** 升序删除，直至总占用低于上限。可选后续增加 **TTL**（`…_MAX_AGE_DAYS`）与 LRU 组合时，须在实现与 README 中写明 **先删 TTL 过期再删 LRU** 或反之。
- **优先级**：P0

**FR-CACHE-003 指纹与 Node 版本**

- **描述**：在现有 lockfile + pm 指纹上，**默认并入 Worker `process.version` 的主版本号**（如 `v20`），避免跨 Node 大版本误用 `node_modules`。若仓库根存在 `.nvmrc` 且可读，可 **额外** 并入其内容哈希（实现可选，文档说明优先级：nvmrc 与 process.version 不一致时的行为）。
- **优先级**：P0

**FR-CACHE-004 可观测**

- **描述**：日志保留 `cache_hit` / `cache_miss`；淘汰时打 `cache_evict` 及 freed 约略字节数（可选）。
- **优先级**：P1

**FR-CACHE-005 按组织配额**

- **描述**：Stretch；可为每组织子目录设 soft/hard 上限。
- **优先级**：P2

---

### 4.3 部署与预览加固（FR-DEPLOY）

**FR-DEPLOY-001 预览 SSR 健康路径**

- **描述**：支持配置健康检查 URL 中的 **path**（不含 scheme/host/port，由现有逻辑固定为 `127.0.0.1` + 候选端口）。**推荐**：`PipelineConfig.previewHealthCheckPath`（可空，默认 `/`）；须 Prisma 迁移 + API + Web 表单。备选仅 env 时须在规格中注明「多项目共 Worker 不推荐」。
- **优先级**：P0

**FR-DEPLOY-002 Linux 站点 Nginx 原子写**

- **描述**：常规环境部署写入 `/etc/nginx/sites-available/{slug}.conf` 时，与预览片段一致采用 **临时文件 + `mv` + `nginx -t` + reload**，避免半写。
- **优先级**：P1

**FR-DEPLOY-003 nvm 与 `[precheck]` 文案**

- **描述**：不强制安装 nvm；当 `command -v node` 失败时，`[precheck]` 错误信息须提示 **交互式登录 shell 与 SSH 非登录 shell 差异**，并指向 README「运维」小节中 nvm 加载示例。
- **优先级**：P0（文案）/ P1（README 章节篇幅）

---

### 4.4 企业微信通知（FR-WEWORK）

**FR-WEWORK-001 渠道枚举与持久化**

- **描述**：在 [packages/shared](../../packages/shared) 增加 `NotificationChannel` 枚举值（如 `wecom` / `wechat_work`）；Prisma `Notification.channel` 存字符串兼容；[notification-config.crypto.ts](../../apps/server/src/modules/notifications/notification-config.crypto.ts) 扩展敏感键（如 `secret`）。
- **优先级**：P1

**FR-WEWORK-002 出站协议**

- **描述**：按企业微信机器人 Webhook 文档 POST JSON（`msgtype`/`markdown`/`text` 等择一或对齐现有 IM 风格）；URL 走 [outbound-url-guard](../../apps/server/src/modules/notifications/outbound-url-guard.ts)。
- **优先级**：P1

**FR-WEWORK-003 API 与 Web**

- **描述**：通知 CRUD 校验 `config.url` 等；管理端项目「通知」Tab 可选渠道与表单字段。
- **优先级**：P1

**FR-WEWORK-004 单测**

- **描述**：对 URL 拼装、可选签名字段（若平台要求）做纯函数或快照测试。
- **优先级**：P1

---

### 4.5 文档与工程（FR-DOC）

**FR-DOC-001 CHANGELOG / 版本**

- **描述**：0.4.0 节按模块；Breaking 或默认行为变化单独标注。
- **优先级**：P0

**FR-DOC-002 README 双语**

- **描述**：§1–§3 与实现一致；新增 **Docker：支持/不支持宿主、依赖、卷、rootless 推荐命令** 小节或表格。
- **优先级**：P0

**FR-DOC-003 自托管矩阵**

- **描述**：表格中 **至少一行** 含可点击 URL（官方文档或本项目 issue）。
- **优先级**：P0

**FR-DOC-004 CI smoke（Stretch）**

- **描述**：可选 job，依赖 `GIT_SMOKE_BASE_URL` 等 secrets。
- **优先级**：P2

---

## 5. 非功能需求

| ID | 类别 | 要求 |
|----|------|------|
| NFR-001 | 可靠 | Docker 路径失败时不得损坏宿主缓存目录结构；应有清晰错误码或日志前缀（如 `[docker-build]`） |
| NFR-002 | 性能 | 开启 LRU 后，淘汰单次耗时应有上限（如单次最多删 N 个条目或异步后台删，文档说明） |
| NFR-003 | 安全 | 容器默认非特权；挂载范围最小化 |
| NFR-004 | 兼容 | v0.3.0 默认配置无 env 时行为不变 |

---

## 6. 数据与配置

- **Prisma**：`PipelineConfig.previewHealthCheckPath`（nullable string）；若企业微信仅需 channel 字符串可不改表结构，仅扩枚举与校验。
- **环境变量**：Docker 镜像名/tag、缓存上限、可选 TTL 等写入 [.env.example](../../.env.example)。

---

## 7. 风险与依赖

| 风险 | 缓解 |
|------|------|
| Docker rootless 与卷权限 | README 给出一套验证命令；首版可文档优先 |
| 缓存 LRU 与并发构建 | 淘汰与读写同一目录时使用文件锁或「仅 Worker 单进程写缓存」说明 |
| 企业微信协议变更 | 单测锁定当前文档版本；注释链到官方 |

---

## 8. 验收标准汇总

| 域 | 验收要点 |
|----|----------|
| FR-DOCKER | Linux + `SHIPYARD_BUILD_USE_DOCKER=true` 完成一次完整 build 并生成与关闭 Docker 时等价的 artifact；非 Linux 有明确报错与文档 |
| FR-CACHE | 人为灌满缓存后触发淘汰，总占用回落；换 Node 大版本后 cache_miss 或新子目录 |
| FR-DEPLOY | 配置 `previewHealthCheckPath` 为非 `/` 时远端探活使用该 path；`[precheck]` 缺 node 时文案含 nvm/登录 shell 提示 |
| FR-DEPLOY-002（P1） | `nginx -t` 不会在半文件上通过；失败可理解 |
| FR-WEWORK（P1） | 一条企业微信配置可收事件；无 secret/url 校验与 SSRF 守卫 |
| FR-DOC | 矩阵含外链；README 含 Docker 矩阵 |

---

## 9. 里程碑（与路线图一致）

| 阶段 | 重点 |
|------|------|
| 0.4.0-alpha | FR-CACHE + FR-DEPLOY-001/003 + FR-DOC 矩阵 |
| 0.4.0-beta | FR-DOCKER P0 + 文档 |
| 0.4.0-rc | FR-DEPLOY-002 + FR-WEWORK + 回归 |

---

## 10. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-11 | 1.0 | 初稿，与审阅后路线图一致；默认淘汰策略锁定 LRU（mtime） |
