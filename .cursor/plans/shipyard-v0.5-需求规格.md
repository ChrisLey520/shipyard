# Shipyard v0.5.0 需求规格说明书

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 对应版本 | **v0.5.0**（已锁定；非 0.4.x 补丁线） |
| 基线版本 | **v0.4.0**（见仓库根 [CHANGELOG.md](../../CHANGELOG.md)） |
| 关联路线图 | [.cursor/plans/shipyard-v0.5-路线图.plan.md](./shipyard-v0.5-路线图.plan.md) |
| 读者 | 产品/研发/测试/运维、Agent 实现参考 |

### 与 v0.4 的增量关系

- [shipyard-v0.4-需求规格.md](./shipyard-v0.4-需求规格.md) 中 **已交付** 的 P0/P1（Docker opt-in、LRU 上限、预览 health、Nginx 原子写、企业微信、文档矩阵等）**继承为基线**，本规格 **不重复验收**。
- v0.4 **Stretch / 未纳入** 项中，与本版相关的部分 **升格或延续** 如下文 FR；**FR-DOCKER-006**（v0.4 标 P2）在 v0.5 **纳入 P0**。

### P0 主线收敛（本版仅两条）

| P0 主线 | 对应章节 | 说明 |
|---------|----------|------|
| **A. Docker 构建安全与资源** | §4.1 | 收紧 `docker run`：默认非特权、可配置 CPU/内存、`--network` 策略文档与默认值 |
| **B. 依赖缓存 TTL + LRU** | §4.2 | 可选 **条目最大存活**（如按天），与现有 **全局字节上限 + LRU** 组合；**必须**文档化淘汰先后顺序 |

其余条目默认 **P1** 或 **Stretch**，见 §2.1。

---

## 1. 背景与目标

### 1.1 背景

v0.4.0 已交付 Linux 上可选 Docker 构建、依赖缓存全局上限与 LRU、预览健康路径、生产 Nginx 原子写、企业微信通知与双语 README 矩阵。运维侧仍需：**容器默认攻击面与资源可预期**、**缓存除磁盘上限外可按陈旧度淘汰**；并延续 v0.4 Stretch（按组织配额、CI 只读探测、通知扩展等）为 **可验收增量**。

### 1.2 版本目标（一句话）

在 **不改变**「默认关闭 Docker 时与 v0.4 行为一致」的前提下，**收紧** Docker 构建的 **资源与安全默认值**，并为依赖缓存增加 **可选 TTL**，与 LRU **组合策略**写清、可测；P1 交付 **可运营/可集成** 增强（组织配额、CI smoke、通知模板、自托管探测等）。

### 1.3 成功标准（版本级）

- 两条 **P0** 均有 §8 对应验收项；`pnpm test` / typecheck 无回归（实现阶段）。
- 新增/变更环境变量写入 [.env.example](../../.env.example)；**CHANGELOG** 0.5.0 节标注 **Behavior**（若有 Docker 默认参数变化）。

---

## 2. 范围与优先级摘要

### 2.1 与路线图对齐的优先级

| 级别 | 内容 |
|------|------|
| **P0** | **A** `docker run` 非 `--privileged`、可配置 CPU/内存上限、默认 `--network` 策略及 README；**B** `SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS`（或等价）与 LRU 组合、淘汰顺序文档 + 实现 |
| **P1** | 按组织缓存配额（soft/hard 或文档化子目录策略）；`GIT_SMOKE_BASE_URL` 类 CI 只读 job；通知消息 **模板变量**（与现有 channel 对齐）；README 自托管矩阵 **版本/issue** 列补强 |
| **Stretch** | `BuildCommandExecutor` / `ProcessBuildExecutor` / `DockerBuildExecutor` **SPI 重构**（与 v0.4 路线图技术债一致）；更细粒度网络策略（按组织禁用 outbound 等，非本版范围） |

### 2.2 Out of Scope

- 多区域 HA、审计日志、合规认证、完整 1.0 商业就绪清单（延续 v0.4 §2.2）。
- macOS/Windows 上 Docker 构建（仍不要求实现）。
- 替换 Docker 为 Podman 的一等公民支持（若仅文档注明兼容性，可放在 FR-DOC，非强制）。

---

## 3. 术语

| 术语 | 含义 |
|------|------|
| TTL（本版） | 缓存指纹目录自 **mtime 或约定锚点时间** 起超过 `MAX_AGE_DAYS` 则视为过期，参与淘汰 |
| 淘汰顺序 | TTL 过期与 LRU（超全局字节上限）同时存在时，**先执行哪一种**须在规格与 README 中唯一确定 |
| 组织配额 | 在全局缓存根下，对单一 `orgId` 子树可配置 **最大字节或最大条目数**（实现选型在 FR 中明确） |

---

## 4. 功能需求

### 4.1 Docker 构建：资源与安全（FR-DOCKER-V5）

**FR-DOCKER-V5-001 非特权默认**

- **描述**：`SHIPYARD_BUILD_USE_DOCKER=true` 且 Linux 时，`docker run` **不得**默认使用 `--privileged`；若未来需可选开启，须单独 env 且默认 false，并在 README 标为高危。
- **优先级**：P0

**FR-DOCKER-V5-002 CPU / 内存上限**

- **描述**：支持通过环境变量（如 `SHIPYARD_BUILD_DOCKER_CPUS`、`SHIPYARD_BUILD_DOCKER_MEMORY` 或 Docker CLI 等价 `--cpus` / `--memory`）限制构建容器；**未配置时**须有文档约定的默认（可与「无限制」明确区分并推荐生产必配）。
- **优先级**：P0

**FR-DOCKER-V5-003 网络模式**

- **描述**：默认 `--network` 策略须为 **明确一种**（如 `bridge` 或 `none` 若可满足 install 拉包——若默认 `none` 不可行则默认 `bridge`），写入 README；可选 env 覆盖；**不得**依赖未文档化的隐式默认。
- **优先级**：P0

**FR-DOCKER-V5-004 可观测与失败**

- **描述**：构建日志中可辨认当前 Docker 限制摘要（镜像、cpus、memory、network）；非法组合配置时启动失败信息带 `[docker-build]`。
- **优先级**：P1

---

### 4.2 构建缓存：TTL 与 LRU（FR-CACHE-V5）

**FR-CACHE-V5-001 可选 TTL**

- **描述**：新增环境变量，例如 `SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS`（正整数，未设置表示 **不启用** TTL 淘汰）。「过期」判定基于指纹目录 **mtime**（或与 v0.4 实现一致的目录时间戳）。
- **优先级**：P0

**FR-CACHE-V5-002 与 LRU 的组合顺序**

- **描述**：当 **同时** 启用全局字节上限与 TTL 时，须实现并文档化 **唯一顺序**，建议：**先剔除 TTL 过期条目，再对剩余总量做 LRU 直至低于上限**（若实现采用其他顺序，须在规格与 README 同步修改本句）。
- **优先级**：P0

**FR-CACHE-V5-003 日志**

- **描述**：TTL 淘汰打 `cache_evict_ttl` 或等价前缀；与现有 `cache_evict`（LRU）可区分。
- **优先级**：P1

**FR-CACHE-V5-004 按组织配额**

- **描述**：对 `orgId` 子目录配置最大字节或条目数（env 或后续 DB 字段，实现前在路线图标注）；超出时仅淘汰该 org 下最旧条目或拒绝写入——**选型须在 PR/ADR 摘要中说明**。
- **优先级**：P1

---

### 4.3 CI 与自托管（FR-CI-V5 / FR-DOC-V5）

**FR-CI-V5-001 Git 只读 smoke**

- **描述**：可选 GitHub Actions job，当 secret `GIT_SMOKE_BASE_URL`（或文档约定变量名）存在时，对给定 **只读** GitLab/Gitea API 或 health 端点发起请求；失败不阻断主 CI 或按团队策略配置为 **warning**。
- **优先级**：P1

**FR-DOC-V5-001 自托管矩阵补强**

- **描述**：README 表增加 **推荐最低版本** 或 **已知 issue 链接** 列（至少一行可点击，可链到本项目 GitHub issue）。
- **优先级**：P1

---

### 4.4 通知（FR-NOTIFY-V5）

**FR-NOTIFY-V5-001 消息模板变量**

- **描述**：在现有 `NotificationEnqueue` 负载上，支持有限占位符（如 `{{projectSlug}}`、`{{deploymentId}}`、`{{event}}`），各 channel 共用渲染层或文档说明各 IM 的转义；**不破坏**现有已存通知配置。
- **优先级**：P1

---

### 4.5 工程与文档（FR-DOC-V5）

**FR-DOC-V5-002 CHANGELOG / README**

- **描述**：0.5.0 按模块；Docker 默认参数或淘汰顺序变化标 **Behavior**；README / README-EN 与 `.env.example` 同步。

**FR-DOC-V5-003 技术债（Stretch）：Build SPI**

- **描述**：将 [build-worker.service.ts](../../apps/server/src/modules/pipeline/build-worker.service.ts) 内 `runCmd` 与 Docker 分支抽取为 `ProcessBuildExecutor` / `DockerBuildExecutor`（或等价接口），**不改变**对外行为；单测覆盖接口边界（可选）。
- **优先级**：Stretch

---

## 5. 非功能需求

| ID | 类别 | 要求 |
|----|------|------|
| NFR-V5-001 | 安全 | 默认 Docker 构建路径下容器 **非特权**；挂载仍为仓库 workdir + 既有策略 |
| NFR-V5-002 | 兼容 | 未设置任何 v0.5 新增 env 时，行为与 **v0.4.0** 一致（除明确 bugfix） |
| NFR-V5-003 | 性能 | TTL + LRU 单次构建路径内淘汰耗时可控；文档说明极端大量条目时的上限策略 |
| NFR-V5-004 | 可运维 | 所有 v0.5 构建相关 env 在 README 有表格或列表 |

---

## 6. 数据与配置

- **Prisma**：v0.5 P0 **可不强制**迁移；若组织配额采用 DB 字段，在路线图标注迁移名。
- **环境变量**（草案名，实现可微调但须同步文档）：
  - `SHIPYARD_BUILD_DOCKER_CPUS`、`SHIPYARD_BUILD_DOCKER_MEMORY`（或合并为单一 JSON，须文档）
  - `SHIPYARD_BUILD_DOCKER_NETWORK`（可选，默认见 FR-DOCKER-V5-003）
  - `SHIPYARD_BUILD_DEPS_CACHE_MAX_AGE_DAYS`
  - `GIT_SMOKE_BASE_URL`（CI secret，非本地 .env.example 必填）

---

## 7. 风险与依赖

| 风险 | 缓解 |
|------|------|
| `--network=none` 导致无法 npm/pnpm 拉包 | 默认选用可拉包的模式；文档写明 |
| TTL 与并发构建同时删目录 | 与 v0.4 相同：文档说明 Worker 假设或加锁（实现选型） |
| 模板变量与 IM 转义 | 企业微信 markdown 等沿用现有转义策略 |

---

## 8. 验收标准汇总

| 域 | 验收要点 |
|----|----------|
| FR-DOCKER-V5（P0） | Linux + Docker 构建时，`docker inspect` 或日志可验证 **无 privileged**、**network 与资源限制**符合配置/默认值 |
| FR-CACHE-V5（P0） | 设置 `MAX_AGE_DAYS` 后过期指纹目录被清理；全局超限时 **先 TTL 后 LRU**（或文档声明的其他唯一顺序）可复现 |
| FR-CACHE-V5-004（P1） | 组织配额策略有可执行验收步骤（文档 + 单测或脚本其一） |
| FR-CI-V5-001（P1） | 仓库内 workflow 可在有 secret 时跑通只读探测；无 secret 时 skip |
| FR-NOTIFY-V5-001（P1） | 至少一渠道消息含模板变量渲染结果；回归现有 channel |
| FR-DOC-V5 | CHANGELOG、双语 README、`.env.example` 与实现一致 |

---

## 9. 里程碑（与路线图一致）

见 [shipyard-v0.5-路线图.plan.md](./shipyard-v0.5-路线图.plan.md) 建议里程碑表。

---

## 10. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-12 | 1.0 | 初稿：P0 锁定 Docker 收紧 + 缓存 TTL/LRU；P1/Stretch 与 v0.5 路线图对齐 |
