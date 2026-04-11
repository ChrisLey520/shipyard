# Shipyard v0.6.0 需求规格说明书

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 对应版本 | **v0.6.0**（已锁定；非 0.5.x 主线补丁） |
| 基线版本 | **v0.5.0**（见仓库根 [CHANGELOG.md](../../CHANGELOG.md)） |
| 关联路线图 | [.cursor/plans/shipyard-v0.6-路线图.plan.md](./shipyard-v0.6-路线图.plan.md) |
| 读者 | 产品/研发/测试/运维、Agent 实现参考 |

### 与 v0.5 的增量关系

- [shipyard-v0.5-需求规格.md](./shipyard-v0.5-需求规格.md) 中 **已交付** 的 P0/P1（Docker 收紧、TTL+LRU+组织配额、`git-smoke`、通知占位符、自托管表与矩阵等）**继承为基线**，本规格 **不重复整段验收**。
- v0.5 **Stretch** 中 **Build 执行器 SPI** 在 v0.6 **升格为 P0**（见 §4.1）。
- **待补项（不复制 v0.5 条文）**：若审计发现 **FR-DOCKER-V5-004**（非法组合配置时启动失败、`[docker-build]` 可观测性）仍有边角未覆盖，在本版以 **单条 FR 或验收子项** 补齐即可，避免整段重复 v0.5。

### P0 主线收敛（本版仅两条）

| P0 主线 | 对应章节 | 说明 |
|---------|----------|------|
| **A. 构建执行器 SPI 落地** | §4.1 | 将 `build-worker` 内进程构建与 Docker 构建抽为可替换执行器，**对外行为与日志**与 v0.5 一致；补 Vitest 边界 |
| **B. 依赖缓存淘汰并发安全** | §4.2 | 文档化并发假设；**文件锁/互斥仅包裹淘汰（evict）调用路径**（含 `evictDepsCacheTtl` / `evictDepsCacheLru` / `evictOrgDepsCacheLru` 及统一入口 `runDepsCacheEvictionPipeline` 的选型边界），不扩散到无关 I/O |

**审阅约束**：**通知可配置模板（Prisma 迁移 + 管理端整包）** 与 SPI 同列 P0 易超标 → 本版 **整包标 P1**（§4.3）；若后续收窄为 **无迁移**（仅 env / 单字段 JSON 等）再讨论是否提升优先级。

其余条目默认 **P1** 或 **Stretch**，见 §2.1。

---

## 1. 背景与目标

### 1.1 背景

v0.5.0 已交付 Docker 资源/网络默认值、依赖缓存 TTL→组织 LRU→全局 LRU、`renderNotificationPlaceholders`、可选 `git-smoke` 与自托管文档矩阵等。研发侧需：**降低 `build-worker` 技术债**（v0.5 Stretch SPI）、**降低多 Worker 并发下缓存目录删除竞态**；产品侧延续 README「仍待增强」：**项目级通知模板**、**自托管兼容**（探测与文档拆分）、**Podman 文档**、**Fork 预览** 等可运营项。

### 1.2 版本目标（一句话）

在 **不改变** v0.5 已承诺的构建与缓存语义的前提下，**落地** 构建执行器 SPI 与 **淘汰路径** 并发安全；P1 交付通知模板整包、自托管 CI 与文档 **独立可验收** 能力，以及文档级运行时说明与可选预览策略。

### 1.3 成功标准（版本级）

- 两条 **P0** 均有 §8 对应验收项；`pnpm test` / typecheck 无回归（实现阶段）。
- 新增/变更环境变量与迁移写入 [.env.example](../../.env.example) 与 **CHANGELOG** 0.6.0 节；若有 **Behavior** 变更须标注。

---

## 2. 范围与优先级摘要

### 2.1 与路线图对齐的优先级

| 级别 | 内容 |
|------|------|
| **P0** | **A** `ProcessBuildExecutor` / `DockerBuildExecutor`（或等价）从 [build-worker.service.ts](../../apps/server/src/modules/pipeline/build-worker.service.ts) 抽出，沿用 [container-build-runner.types.ts](../../apps/server/src/modules/pipeline/container-build-runner.types.ts) 方向；**B** 缓存 **evict 路径** 互斥或文档化强假设 + 实现选型在 PR 摘要说明 |
| **P1** | 项目级通知 `message` 模板（DB + 管理端或等价）与占位符组合；**FR-CI-V6**（`git-smoke` 多 URL / 扩展）；**FR-DOC-V6-001**（自托管 Git API 版本脚本或文档矩阵，与 CI **拆分**）；Podman/`docker` CLI **仅文档** |
| **Stretch** | Fork PR 预览策略与隔离（易膨胀，默认不承诺进 0.6.0） |

### 2.2 Out of Scope

- 多区域 HA、审计日志、合规认证、完整 1.0 商业就绪清单（延续 [shipyard-v0.5-需求规格.md](./shipyard-v0.5-需求规格.md) §2.2）。
- macOS/Windows 上 Docker 构建（仍不要求实现）。
- 将 Podman 提升为与 Docker **对等** 的一等运行时实现（本版仅文档）。

---

## 3. 术语

| 术语 | 含义 |
|------|------|
| 构建执行器 SPI | 进程内构建与容器内构建共用边界接口，便于单测与后续替换 `runInBuildContainer` 实现 |
| Evict 路径 | 仅指依赖缓存 **删除指纹目录** 的代码路径（TTL / 全局 LRU / 组织 LRU 及统一 pipeline），不含普通构建读写 |
| 文件锁 | 进程间互斥实现选型可为 `flock`、专用 lock 文件或 Node 单进程内 mutex（若仅多 worker 跨进程则须跨进程锁）；**范围**须在 FR 中写死为 evict 入口 |

---

## 4. 功能需求

### 4.1 构建执行器 SPI（FR-BUILD-V6）

**FR-BUILD-V6-001 执行器拆分**

- **描述**：将 [build-worker.service.ts](../../apps/server/src/modules/pipeline/build-worker.service.ts) 内 **本地 `runCmd` 路径** 与 **Docker 构建路径** 抽取为独立模块或类（如 `ProcessBuildExecutor`、`DockerBuildExecutor`），由 `BuildWorker` 编排调用；**日志前缀、退出码语义、超时** 与 v0.5 一致。
- **优先级**：P0

**FR-BUILD-V6-002 类型与注入**

- **描述**：与 [container-build-runner.types.ts](../../apps/server/src/modules/pipeline/container-build-runner.types.ts) 对齐或收敛类型；避免循环依赖；Nest 注入方式在实现 PR 中简述。
- **优先级**：P0

**FR-BUILD-V6-003 回归测试**

- **描述**：至少 **Vitest** 覆盖执行器边界（mock 子进程 / 容器调用），避免纯重构无测。
- **优先级**：P0

---

### 4.2 构建缓存：淘汰并发（FR-CACHE-V6）

**FR-CACHE-V6-001 并发假设文档**

- **描述**：在 README 或运维小节说明：多 Worker、同机缓存目录时的 **竞态风险** 与部署假设（例如单机单构建进程 vs 多进程）。
- **优先级**：P0

**FR-CACHE-V6-002 Evict 路径互斥**

- **描述**：在 [build-deps-cache.ts](../../apps/server/src/modules/pipeline/build-deps-cache.ts) 的 **淘汰** 相关函数或 `runDepsCacheEvictionPipeline` **外层** 引入互斥，保证 **同一缓存根** 上不会并发执行重叠的 `rmSync` 淘汰；**不得**将锁扩大到非淘汰 I/O。
- **优先级**：P0

**FR-CACHE-V6-003 可选指标**

- **描述**：可选：淘汰次数/失败次数日志或指标钩子（若已有日志前缀则扩展即可）。
- **优先级**：P1

---

### 4.3 通知可配置模板（FR-NOTIFY-V6）

**FR-NOTIFY-V6-001 项目级模板存储**

- **描述**：支持项目（或组织）级默认通知 `message` **模板** 持久化（Prisma 迁移 + API）；与现有 `renderNotificationPlaceholders` 组合；**不破坏**已有通知发送路径。
- **优先级**：P1

**FR-NOTIFY-V6-002 管理端**

- **描述**：管理后台提供模板编辑或绑定入口（字段级与现有 UI 风格一致）。
- **优先级**：P1

---

### 4.4 CI 与自托管（FR-CI-V6 / FR-DOC-V6）

**FR-CI-V6-001 Git 探测扩展**

- **描述**：在 v0.5 `git-smoke` 基础上支持 **多 URL** 或 **列表顺序探测**（仍只读、失败策略为 skip/warn 可配置）；变量名与 workflow 文档同步。
- **优先级**：P1

**FR-DOC-V6-001 自托管 API 版本矩阵**

- **描述**：**独立 FR**：脚本或文档化步骤读取 GitLab/Gitea **API 版本** 字段，形成 **兼容矩阵**（与 FR-CI-V6-001 **分开验收**，避免单 FR 含糊）。
- **优先级**：P1

---

### 4.5 文档与其它（FR-DOC-V6）

**FR-DOC-V6-002 Podman / docker CLI**

- **描述**：README / README-EN 增加 **仅文档**：使用 `docker` CLI 兼容层（如 Podman）时的注意事项与不支持声明。
- **优先级**：P1

**FR-DOC-V6-003 CHANGELOG / README**

- **描述**：0.6.0 按模块；Behavior 变更标注；`.env.example` 同步。

**FR-PREVIEW-V6-001 Fork 预览策略（Stretch）**

- **描述**：Fork 场景下 PR 预览的启用策略、隔离与配额；若纳入需单独评审范围。
- **优先级**：Stretch

---

## 5. 非功能需求

| ID | 类别 | 要求 |
|----|------|------|
| NFR-V6-001 | 兼容 | SPI 重构后 **默认配置** 下构建结果与 v0.5 等价（除明确 bugfix） |
| NFR-V6-002 | 安全 | Evict 锁实现不引入 world-writable lock 文件路径；文档说明多租户缓存根隔离 |
| NFR-V6-003 | 性能 | 锁粒度仅限 evict；淘汰耗时在极端条目数下有上界说明 |
| NFR-V6-004 | 可运维 | 新增 env / 迁移在 README 或运维表可见 |

---

## 6. 数据与配置

- **Prisma**：通知模板 **P1** 若落 DB，须命名迁移并在路线图标注。
- **环境变量**（草案名，实现可微调须同步文档）：
  - Evict 锁：实现可选用既有缓存根下 `.lock` 或独立 env 指定锁路径（若需要）
  - CI：`GIT_SMOKE_*` 扩展名在 FR-CI-V6-001 落稿

---

## 7. 风险与依赖

| 风险 | 缓解 |
|------|------|
| 跨平台 `flock` 行为差异 | Linux 为首支持目标；其它平台文档声明 |
| 锁文件残留 | 超时、启动清理或文档运维步骤 |
| 通知模板与 IM 转义 | 沿用 v0.5 各 channel 转义策略 |

---

## 8. 验收标准汇总

| 域 | 验收要点 |
|----|----------|
| FR-BUILD-V6（P0） | 构建成功路径在 Docker on/off 下与 v0.5 行为一致；单测覆盖执行器边界 |
| FR-CACHE-V6（P0） | 文档含并发假设；压测或脚本可演示 **同缓存根** 多并发淘汰不再交叉删除（或等价安全策略） |
| FR-CACHE-V6-003（P1） | 若有指标/日志扩展，可在验收表给出 grep 或查询步骤 |
| FR-NOTIFY-V6（P1） | 项目级模板持久化 + 至少一渠道渲染正确 + 回归旧配置 |
| FR-CI-V6-001（P1） | Workflow 在多 URL 配置下可验证；无配置时 skip |
| FR-DOC-V6-001（P1） | 矩阵或脚本输出与文档步骤一致，**不依赖** CI job 合并验收 |
| FR-DOC-V6-002（P1） | 双语 README 可定位 Podman 说明段落 |
| FR-DOC-V6-003 | CHANGELOG、README、`.env.example` 一致 |

---

## 9. 里程碑（与路线图一致）

见 [shipyard-v0.6-路线图.plan.md](./shipyard-v0.6-路线图.plan.md) 建议里程碑表。

---

## 10. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-11 | 1.0 | 初稿：P0 锁定 SPI + 缓存 evict 并发；P1 通知整包、自托管 CI/文档拆 FR；Stretch 预览 |
