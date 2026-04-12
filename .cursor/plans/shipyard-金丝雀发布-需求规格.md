# Shipyard 金丝雀发布（Canary）需求规格

## 关联文档

- 运维说明：[docs/runbooks/canary-nginx.md](../../docs/runbooks/canary-nginx.md)
- 路线图：[shipyard-金丝雀发布-路线图.plan.md](./shipyard-金丝雀发布-路线图.plan.md)
- 能力继承：[shipyard-发布策略扩展-路线图.plan.md](./shipyard-发布策略扩展-路线图.plan.md) 阶段 D
- 代码锚点：`apps/server/src/modules/environments/domain/release-config.schema.ts`、`apps/server/src/modules/deploy/application/deploy.application.service.ts`

---

## 1. 范围与假设

- **执行面**：SSH 入口机 Nginx；在 **`executor: ssh` 且 `strategy: canary`** 下生效。
- **语义**：金丝雀 = **入口流量按百分比在两条已存在的 `upstream` 之间分配**（`split_clients`）；**不**在本期自动创建 upstream 内 `server` 行，运维须在主配置中维护 stable/canary 后端。
- **部署顺序**：与现状一致——多机 **全量 rsync** 后，**仅入口机** 写入金丝雀片段并重载 Nginx。

---

## 2. 功能需求（FR）

### FR-CANARY-1 配置字段（P0）

- **描述**：在 `releaseConfig.ssh` 增加：
  - `nginxCanaryStableUpstream`：字符串，合法 Nginx upstream 名（`^[a-zA-Z_][a-zA-Z0-9_]*$`，长度 ≤64）。
  - `nginxCanaryCandidateUpstream`：同上。
- **描述**：保留现有 `canaryPercent`（0–100）、`nginxCanaryPath`、`nginxCanaryBody`。

### FR-CANARY-2 片段生成（P0）

- **描述**：当 **`nginxCanaryBody` 未提供或仅空白** 时，由服务端根据 `canaryPercent` + 双 upstream 名生成 **Nginx `split_clients`** 片段；变量名为 `shipyard_canary_pool`，供主配置 `proxy_pass http://$shipyard_canary_pool;` 使用。
- **描述**：`split_clients` 哈希输入使用 `"${remote_addr}${http_shipyard_canary_seed}"`；`http_shipyard_canary_seed` 可由运维置空或自定义，用于可重复测试。

### FR-CANARY-3 手写优先（P0）

- **描述**：若 `nginxCanaryBody` **非空**（trim 后），**完全使用手写内容**，忽略生成器；仍须提供 `nginxCanaryPath`。

### FR-CANARY-4 保存时校验（P0）

- **描述**：`strategy === 'canary'` 且 `executor === 'ssh'` 时：
  - 必须提供 **`nginxCanaryPath`**（非空白）。
  - **手写模式**：`nginxCanaryBody` trim 后非空 → 仅需上述路径（`canaryPercent`、upstream 名可选，不参与生成）。
  - **生成模式**：`nginxCanaryBody` 缺失或空白 → 必须提供 **`canaryPercent`**（0–100）、`nginxCanaryStableUpstream`、`nginxCanaryCandidateUpstream`。
- **描述**：`executor === 'kubernetes'` 且 `strategy === 'canary'` → **400**，文案说明当前不支持（与 K8s 全量 `set image` 模型不兼容）。

### FR-CANARY-5 原子写入与失败恢复（P0）

- **描述**：写入最终文件前，若目标已存在则 **备份**；执行 `nginx -t`；**失败**则 **用备份恢复目标文件**（若曾备份），部署失败；**成功**再 `nginx -s reload`。避免 `nginx -t` 失败时长期留下未 reload 的坏文件且无恢复路径。

### FR-CANARY-6 部署日志（P1）

- **描述**：生成模式写入前打日志 `[deploy] canary_fragment_generated split_clients …`；手写模式 `[deploy] canary_fragment_manual`；与现有 `traffic_switch` / 原子更新成功日志并存。

### FR-CANARY-7 管理端（P1）

- **描述**：环境表单在检测到 **发布策略为 canary**（由表单字段驱动，见路线图）时展示：百分比、片段路径、stable/candidate upstream、高级「自定义片段」文本框；提交时 **合并** 为 `releaseConfig` JSON，与仅编辑 JSON 等价。

---

## 3. 非功能需求（NFR）

- **NFR-CANARY-1**：未配置 `releaseConfig` 或 `strategy !== 'canary'` 时行为与改前一致。
- **NFR-CANARY-2**：兼容存量仅含 `nginxCanaryPath` + `nginxCanaryBody` 的环境。
- **NFR-CANARY-3**：新增生成函数具备 Vitest 单测（边界百分比、非法字符拒绝在 Zod 层）。

---

## 4. 验收检查表

- [ ] 生成模式：仅填 path、percent、双 upstream，Linux 入口机成功 `nginx -t` 并重载。
- [ ] `nginx -t` 失败：目标文件恢复为写入前内容（有旧文件时）。
- [ ] 手写 `nginxCanaryBody` 非空时，修改 percent/upstream 不改变实际写入内容。
- [ ] 不完整 canary 配置保存环境返回 **400**。
- [ ] `kubernetes` + `canary` 保存 **400**。
- [ ] README / README-EN 发布策略表与 runbook 片段说明已更新。

---

## 5. 明确不做（本期）

- K8s 加权发布 / Argo Rollouts / Flagger。
- 自动生成 `upstream { server ... }` 块。
- 与 `blue_green` 组合的一键编排（仅文档说明限制）。
- 产品内「晋升全量流量」专用 API。
