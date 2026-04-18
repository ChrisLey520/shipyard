# Shipyard 顺架构发布策略扩展 — 需求规格

## 关联文档

- 路线图：[shipyard-顺架构发布策略-路线图.plan.md](./shipyard-顺架构发布策略-路线图.plan.md)
- 总规划：[shipyard-顺架构发布策略扩展.plan.md](./shipyard-顺架构发布策略扩展.plan.md)

---

## 1. 轴线 A — SSH 金丝雀 `upstream_weight` 模板

### FR-A1（P0）

- `ssh.nginxCanaryTemplate`：`split_clients` | `upstream_weight`，缺省等价 `split_clients`。
- `upstream_weight` 生成模式须配置：`nginxCanaryPath`、`canaryPercent`、`nginxCanaryUpstreamName`（合法 upstream 名）、`nginxCanaryStableBackend`、`nginxCanaryCandidateBackend`（`host:port`，支持 IPv4、IPv6 `[addr]:port`、主机名）。
- 生成片段为完整 `upstream <name> { server ... weight=...; }`；主配置 `include` 后 `proxy_pass http://<name>;`。
- 权重：`candidate` = `canaryPercent`，`stable` = `100 - canaryPercent`；`0%` / `100%` 时仅输出单条 `server`。
- 手写 `nginxCanaryBody` 仍优先，忽略模板与生成字段。

### 验收 A

- [ ] Zod 对两种模板分别校验必填项。
- [ ] 部署日志区分 `canary_fragment_generated_split_clients` / `canary_fragment_generated_upstream_weight`。

---

## 2. 轴线 B — Kubernetes `strategy` 与 rollout

### FR-B1（P0）

- `executor: kubernetes` 且 `strategy: blue_green` → 保存 **400**（与 canary 一致）。
- `kubernetes.rolloutTimeoutSeconds`：可选，整数 60–3600，默认 600；传给 `kubectl rollout status --timeout=Ns`。
- `strategy: rolling` 且配置了 `kubernetes.rollingUpdateMaxSurge` 和/或 `rollingUpdateMaxUnavailable`（字符串，如 `25%`、`1`）时，在 `set image` **前** `kubectl patch deployment` strategic 合并 `spec.strategy.rollingUpdate`。

### FR-B2（NFR）

- 文档说明：若 Deployment 由 GitOps 管理，patch 可能被覆盖；仅 `rolloutTimeout` 时无此问题。

### 验收 B

- [ ] `direct` + 自定义超时：rollout 使用对应 timeout。
- [ ] `rolling` + surge/unavailable：patch 后 set image 再 status。

---

## 3. 轴线 C — `object_storage` 执行器（S3 兼容）

### FR-C1（P0）

- `executor: object_storage`；**仅** `strategy: direct`（否则 400）。
- `objectStorage`：`provider: s3`，`bucket`（必填），`prefix`（可选），`region`（可选），`credentialsEncrypted`（可选，解密后为 JSON `accessKeyId`/`secretAccessKey`，与组织加密方式一致）。
- 无 `credentialsEncrypted` 时依赖 Worker 环境 **默认凭证链**（如 `AWS_ACCESS_KEY_ID`、IAM Role）。
- 部署：本地解压构建产物后执行 `aws s3 sync <dir> s3://bucket/prefix --delete`（`prefix` 非空时尾部补 `/`）；日志禁止打印密钥。

### 验收 C

- [ ] 缺 bucket 保存失败。
- [ ] 同步失败时部署失败；健康检查与 Prometheus 门禁仍可在之后执行（与 SSH/K8s 一致）。

---

## 4. 明确不做（本期）

- Argo Rollouts 插件、GitOps reconcile、CDN 失效、非 S3 协议族（如专有 OSS 签名）。
