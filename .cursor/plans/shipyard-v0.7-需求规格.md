# Shipyard v0.7.0 需求规格（FR / NFR / 验收）

## 1. 范围与假设

- **在册能力**：见仓库 `README.md` / `README-EN.md`「发布策略与环境配置」表；本规格只定义 **v0.7 增量**。
- **运行环境**：Deploy/Build Worker 仍为 Node + 宿主工具（`ssh`/`rsync`/`docker`/`kubectl`）；不改变 v0.6 构建矩阵约定。

---

## 2. 功能需求（FR）

### FR-7.1 FeatureFlag 唯一性（P0）

- **描述**：同一组织内，**组织级**开关 `(organizationId, key)` 唯一；**项目级**开关 `(projectId, key)` 唯一。
- **实现建议**：PostgreSQL **部分唯一索引**两条（`projectId IS NULL` / `IS NOT NULL`），与应用层校验并存。
- **验收**：重复 POST 返回 **409** 或 **400**（与现有 `ConflictException` 一致）；迁移对存量数据无重复假设（若有重复需数据修复脚本，本版本可文档说明）。

### FR-7.2 Prometheus 门禁仅 HTTPS（P0）

- **描述**：`releaseConfig.gates.prometheus.queryUrl` 在 **保存环境** 与 **执行门禁** 时均须为 **`https:`**（禁止 `http:`）。
- **验收**：`http://` 配置保存失败（400）；运行时若绕过 JSON 仍拒绝（双保险）。

### FR-7.3 Hook 输出上限（P0）

- **描述**：`preDeploy` / `postDeploy` 单条命令合并 stdout/stderr 写入 `deploymentLog` 时，**单行长度**与**单次命令总字符**设上限（具体数值见实现常量，建议：单行 ≤4KB、单次 ≤64KB，超出截断并标记 `[truncated]`）。
- **验收**：恶意或刷屏命令不会撑爆单条 `DeploymentLog.content`；部署仍成功或失败行为与命令 exit code 一致。

### FR-7.4 常规环境 SSR + blue_green（P1）

- **描述**：当 `executor=ssh`、`strategy=blue_green`、`frameworkType=ssr`、目标为 **Linux** 且配置 **域名** 时：
  - 使用 **双槽 PM2**（命名与预览区分，如 `sh-env-{slug}-{env}-bg0|1`）；
  - 新槽启动后经 **HTTP 健康检查**（环境 `healthCheckUrl` 或 `deployPath` 内约定路径，与现有健康检查策略一致）再切换 **站点 Nginx** `proxy_pass` 至新端口；
  - 失败时删除候选槽进程并尽量恢复 Nginx 与 **不提升** `blueGreenActiveSlot`。
- **验收**：与静态蓝绿类似：零 `releaseConfig` 行为不变；配置 blue_green 的 SSR 环境两次连续部署可在日志中看到 `candidate_up` / `health_ok` / `traffic_switch`；失败路径有回滚日志。

### FR-7.5 文档（P2）

- **描述**：新增 `docs/adr/` 或 `docs/` 短文：**Kubeconfig、registry 凭据、Worker 上 kubectl** 的威胁模型与运维建议（不要求完整 ADR 模板，但需有「密钥面」「最小权限」两节）。
- **验收**：README 或发布策略章节可链到该文档。

---

## 3. 非功能需求（NFR）

- **NFR-7.1**：不改变未配置 `releaseConfig` 的默认 SSH 直连语义。
- **NFR-7.2**：新迁移须可 `prisma migrate deploy` 在空库与已有库执行；禁止破坏 `EnvironmentServer` 回填数据。
- **NFR-7.3**：类型检查与现有 server Vitest 套件通过；新增逻辑优先补单测（URL 校验、截断工具函数）。

---

## 4. 验收检查表（发版前）

- [ ] 重复 FeatureFlag 被 DB 或 API 拒绝。
- [ ] Prometheus HTTP URL 无法保存且运行时不执行。
- [ ] Hook 大输出被截断，部署记录可打开。
- [ ] SSR blue_green E2E 或手工脚本步骤写在 PR 描述或 README 子节（二选一最低）。
- [ ] CHANGELOG `[0.7.0]` 草案与 `package.json` 版本一致（若本迭代只合入部分 FR，则在 CHANGELOG 标注「部分交付」或拆 0.7.1）。

---

## 5. 明确不做（本版本）

- 多机 **并行** rsync + 每机独立锁。
- 自动根据 `canaryPercent` 生成 Nginx 片段（仍用手动 `nginxCanaryBody`）。
- Feature Flag 运行时 SDK（仍仅 API + 管理端）。
