# Shipyard v0.3.0 需求规格说明书

| 项 | 内容 |
|----|------|
| 文档版本 | 1.0 |
| 对应版本 | **v0.3.0**（下一主版本波次） |
| 基线版本 | **v0.2.0**（见仓库根 [CHANGELOG.md](../../CHANGELOG.md)） |
| 关联路线图 | [.cursor/plans/shipyard-v0.3-路线图.plan.md](./shipyard-v0.3-路线图.plan.md) |
| 读者 | 产品/研发/测试/运维、Agent 实现参考 |

---

## 1. 背景与目标

### 1.1 背景

v0.2.0 已完成：组织维度产物保留、`worker:new-org` 与 Notify 动态队列、钉钉机器人加签、构建/部署日志 DB 与 Redis 分流容错、部署失败 `code`/`errno` 提示、GitHub Actions（单测 + E2E）及版本号统一。README「下一阶段规划」中仍留有 **PR 预览蓝绿**、**飞书/Slack 加签**、**构建缓存与 Docker 隔离**、**部署预检** 等深化项，适合在 v0.3.0 收敛为可验收能力。

### 1.2 版本目标（一句话）

在不大改多租户与队列模型的前提下，提升 **PR 预览可用性（少空窗、可回滚）**、**通知渠道完整性**、**构建效率与隔离**、**部署前可诊断性**，并同步文档与 CI。

### 1.3 成功标准（版本级）

- 主路径功能在「默认自托管部署形态」下可重复验收（见第 8 节）。
- 无未文档化的 Breaking；CHANGELOG / README 与行为一致。
- 新增逻辑具备可维护单测或 E2E 钩子（与现有 Vitest / Playwright 策略一致）。

---

## 2. 范围

### 2.1 In Scope（v0.3.0）

| 域 | 说明 |
|----|------|
| PR 预览 SSR | 蓝绿式切换：新旧实例并行、健康检查通过后切流、Nginx 配置原子更新、失败回滚策略 |
| 通知 | 飞书、Slack 在配置 `secret` 时按官方协议加签/鉴权；无 `secret` 时与现网行为一致 |
| 构建 | 基于 lockfile（及包管理器类型）的依赖缓存失效策略；workdir 命名、并发隔离与异常清理 |
| 部署 | SSH 就绪后对 nginx / rsync / pm2 /（SSR 时）nvm 等做轻量预检；失败信息结构化、可指导运维 |
| Docker 构建（Phase 2） | rootless 容器执行构建、资源限制与 seccomp；**允许**以 feature flag 或 v0.3.1 交付实体，v0.3.0 至少定义接口与文档 |
| 文档与工程 | README 路线图更新、CHANGELOG 0.3.0、自托管 Git 兼容矩阵（文档为主，可选 smoke） |

### 2.2 Out of Scope

- 多区域高可用、审计日志、合规认证（如 SOC2）。
- 直接发布 **1.0** 级「商业就绪」打包（独立里程碑）。
- 替换 BullMQ 组织队列模型或统一为单队列（非本版目标）。

---

## 3. 术语

| 术语 | 含义 |
|------|------|
| 蓝绿（预览） | 新版本与旧版本短时并存，流量切换前新版本通过健康检查 |
| 原子切换（Nginx） | 配置以临时文件写入再 `rename` 等方式切换，避免半文件被 include |
| lockfile 指纹 | 由 `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json` 等内容哈希构成的缓存键 |
| 预检 | 部署脚本执行前在远端执行的只读/轻量命令检测 |

---

## 4. 功能需求

### 4.1 PR 预览 SSR 蓝绿（FR-PREVIEW）

**FR-PREVIEW-001 并行实例**

- **描述**：同一 PR 预览在一次部署中允许存在「候选」与「当前」两套 SSR 进程配置（端口/PM2 应用名策略需与现有 [deployPreview](../../apps/server/src/modules/deploy/application/deploy.application.service.ts) 端口池一致且不泄漏）。
- **优先级**：P0

**FR-PREVIEW-002 健康检查门禁**

- **描述**：在将流量切到候选实例前，必须对候选实例执行可配置或约定端点的 HTTP 健康检查（可与环境 `healthCheckUrl` 概念对齐或预览专用路径）；超时与重试次数需有上限。
- **优先级**：P0

**FR-PREVIEW-003 Nginx 原子切换**

- **描述**：写入 `PREVIEW_NGINX_DIR` 下片段时采用原子替换策略，避免 `nginx -t` / reload 读到半成品；切换顺序与回滚顺序需在代码注释或内部 ADR 中说明。
- **优先级**：P0

**FR-PREVIEW-004 失败回滚**

- **描述**：若在健康检查或切换阶段失败，应恢复 Nginx 指向旧实例（或旧端口），并释放候选资源；与现有 Redis 端口占用回滚逻辑兼容。
- **优先级**：P0

**FR-PREVIEW-005 可观测**

- **描述**：部署日志中需包含阶段标记（如 candidate_up、health_ok、traffic_switch、rollback）。
- **优先级**：P1

---

### 4.2 通知：飞书 / Slack 加签（FR-NOTIFY）

**FR-NOTIFY-001 飞书加签**

- **描述**：当 `channel=feishu` 且 `config.secret` 解密后非空时，按飞书开放平台对自定义机器人「签名校验」要求构造请求（时间戳 + 签名，具体算法以当前官方文档为准）。
- **优先级**：P0

**FR-NOTIFY-002 Slack 签名校验（如适用）**

- **描述**：若使用 Slack Incoming Webhook 且平台要求 HMAC 或签名头，则在配置 `secret` 时启用；若无签名模式则保持 URL-only。
- **优先级**：P0（若官方 Webhook 无 secret 模式则文档标明「仅 URL」并降级为 P2 文档需求）

**FR-NOTIFY-003 兼容与 SSRF**

- **描述**：加签后的最终请求 URL 仍须经过现有 [assertSafeOutboundHttpUrl](../../apps/server/src/modules/notifications/outbound-url-guard.ts)（或等价入口）。
- **优先级**：P0

**FR-NOTIFY-004 单测**

- **描述**：为飞书/Slack 签名拼装增加与 [dingtalk-webhook-sign.spec.ts](../../apps/server/src/modules/notifications/dingtalk-webhook-sign.spec.ts) 同类的纯函数或黄金用例测试。
- **优先级**：P1

---

### 4.3 构建缓存与 workdir（FR-BUILD）

**FR-BUILD-001 缓存键**

- **描述**：缓存键至少包含：组织或项目维度（二选一需在设计中固定）、lockfile 内容哈希、包管理器类型、Node 版本（若影响 install）。
- **优先级**：P0

**FR-BUILD-002 缓存目录与失效**

- **描述**：缓存根目录可配置（环境变量），默认落在安全路径；lockfile 变化即 miss；提供容量或 TTL 上限（可先文档化手动清理，代码预留钩子）。
- **优先级**：P0

**FR-BUILD-003 并发与 workdir**

- **描述**：`deploymentId` 级 workdir 互斥；异常退出时 `finally` 清理与缓存目录分离，避免误删缓存。
- **优先级**：P0

**FR-BUILD-004 可观测**

- **描述**：日志中打印 cache hit/miss 及所用指纹摘要（非完整 lockfile）。
- **优先级**：P2

---

### 4.4 部署远端预检（FR-DEPLOY）

**FR-DEPLOY-001 预检范围**

- **描述**：常规环境与 PR 预览路径中，在 rsync/大量远程命令前执行：`rsync`、`nginx`、`bash` 存在性；SSR 路径增加 `pm2`、`node`/`nvm`（与当前脚本一致）。
- **优先级**：P0

**FR-DEPLOY-002 错误格式**

- **描述**：失败时日志首行包含统一前缀（如 `[precheck]`）及缺失项列表；可选附带安装提示链接（README 或发行版说明）。
- **优先级**：P0

**FR-DEPLOY-003 不误判**

- **描述**：使用 `command -v` 或等价方式；不在预检阶段执行破坏性操作。
- **优先级**：P0

---

### 4.5 Docker 构建隔离（FR-DOCKER）

**FR-DOCKER-001 执行模型**

- **描述**：提供「在容器内执行与现网等价的 install/build」的适配层；默认关闭，通过环境变量或组织级开关启用（具体键名在实现时写入 README）。
- **优先级**：P1（整项可拆 v0.3.1）

**FR-DOCKER-002 安全**

- **描述**：rootless、CPU/内存上限、默认 seccomp profile；禁止 `--privileged` 作为默认路径。
- **优先级**：P1

**FR-DOCKER-003 产物路径**

- **描述**：容器内构建产出与宿主机 `ARTIFACT_STORE_PATH` 约定一致，权限与 uid/gid 文档说明。
- **优先级**：P1

---

### 4.6 文档与自托管矩阵（FR-DOC）

**FR-DOC-001 README**

- **描述**：更新 [README.md](../../README.md) §1/§2/§3 与 v0.3 实现一致；PR 预览运维步骤与蓝绿行为补充。
- **优先级**：P0

**FR-DOC-002 兼容矩阵**

- **描述**：GitLab/Gitea/Gitee 自托管：Webhook 事件、评论 API、已知版本差异表（可链到 issue）。
- **优先级**：P1

**FR-DOC-003 E2E（可选）**

- **描述**：在 [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 可接受的耗时内，为预检失败或缓存命中增加一条弱断言或文档化「手动回归清单」。
- **优先级**：P2

---

## 5. 非功能需求

| ID | 类别 | 要求 |
|----|------|------|
| NFR-001 | 性能 | 同 lockfile 二次构建 install 阶段耗时较 v0.2.0 基线明显下降（建议在 CI 或文档给出抽样对比方法） |
| NFR-002 | 安全 | 新增出站 URL、密钥参与签名的路径不削弱 SSRF 策略 |
| NFR-003 | 可靠 | 预览蓝绿失败不得长期占用端口池；必须释放或回滚 |
| NFR-004 | 可维护 | 复杂状态机（预览切换）建议拆私有方法或小型领域服务，便于单测 |

---

## 6. 数据与配置影响

- **Schema**：默认不新增表；若引入「构建缓存元数据」表需单独评审迁移。
- **环境变量**：新增变量须在 [.env.example](../../.env.example) 与 README 说明。
- **Breaking**：若默认行为变化（如预览切换时序），须在 CHANGELOG 标注 **Breaking** 或 **Behavior**。

---

## 7. 依赖与风险

| 风险 | 缓解 |
|------|------|
| 蓝绿实现与现有 PM2/端口池交互复杂 | 分阶段合并；先 feature flag；充分日志 |
| 飞书/Slack 协议变更 | 文档链官方版本；单测锁定算法向量 |
| Docker 在 CI 与用户机差异大 | 默认关闭；先文档与镜像发布说明 |
| 排期不足 | Docker 整项并入 v0.3.1，本版仅接口 + 文档 |

---

## 8. 验收标准汇总

| 需求域 | 验收要点 |
|--------|----------|
| FR-PREVIEW | 连续两次 SSR 预览部署成功；中途注入失败可回滚且端口无泄漏 |
| FR-NOTIFY | 飞书/Slack 各 1 条带 secret 配置能收到事件；无 secret 与 v0.2 行为一致 |
| FR-BUILD | 同 lockfile 第二次构建观察到 cache hit；并发两构建 workdir 不冲突 |
| FR-DEPLOY | 故意移除远端 `rsync` 时日志含 `[precheck]` 与明确指引 |
| FR-DOCKER | flag 关闭时零行为变化；开启时完成一次端到端构建（若本版交付） |
| FR-DOC | README/CHANGELOG/E2E 或手动清单已更新 |

---

## 9. 里程碑建议（与路线图一致）

| 阶段 | 交付重点 |
|------|----------|
| 0.3.0-alpha | FR-NOTIFY + FR-DEPLOY + FR-BUILD（MVP） |
| 0.3.0-beta | FR-PREVIEW 主路径 + 文档 |
| 0.3.0-rc | FR-DOCKER（或占位）+ 全量回归 |

---

## 10. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-11 | 1.0 | 根据 v0.3 路线图初稿整理为需求规格 |
