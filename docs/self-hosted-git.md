# 自托管 Git 实例兼容（拆分说明）

本文将 **CI 只读探测** 与 **实例 API 版本自检** 分开描述，便于各自验收与排障。

---

## 1. CI 只读探测（git-smoke）

**目的**：在流水线中对一个或多个 **只读可达** 的 URL 做连通性检查（如自建 GitLab 的 `/users/sign_in`、健康检查或 API 根路径）。

**配置**（GitHub Actions **Repository secrets**，任选其一或组合）：

| Secret | 说明 |
|--------|------|
| `GIT_SMOKE_URLS` | **优先**。多行文本，**每行一个 URL**；job 对每一行依次 `curl -sfI`（取首行响应）。 |
| `GIT_SMOKE_BASE_URL` | **兼容 v0.5**：单 URL；仅当 `GIT_SMOKE_URLS` 为空或未配置时生效。 |

**行为**：

- 若 `GIT_SMOKE_URLS` 非空：按行拆分（去空行），逐个探测。
- 否则若配置了 `GIT_SMOKE_BASE_URL`：只探测该 URL。
- 若两者皆无：job 跳过。

实现见仓库根目录 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 中 `git-smoke` job。

---

## 2. 实例 API 版本矩阵（运维 / 文档）

**目的**：确认自建 **GitLab** 或 **Gitea** 的 **版本 JSON**，与 Shipyard README 中的兼容表对照；**不替代** 上文 CI job（CI 只做 HTTP 可达性，不解析版本字段）。

### GitLab

对实例根地址请求（匿名可读时）：

```http
GET {origin}/api/v4/version
```

响应体通常含 `version` 字段。

### Gitea

```http
GET {origin}/api/v1/version
```

### 仓库脚本

可使用 Node 脚本（需 Node 18+，仅依赖内置 `fetch`）：

```bash
node scripts/probe-git-api-version.mjs https://gitlab.example.com
```

脚本会依次尝试 GitLab v4 与 Gitea v1 的 version 端点，打印首个成功的 JSON。

---

## 3. 与 Shipyard 功能的关系

- **Webhook / OAuth / Commit Status** 仍取决于各平台在 **项目内** 配置的 `baseUrl` 与 Token；本文不重复产品内流程。
- 若 CI 与脚本均失败，请优先检查 **网络**、**TLS**、**防火墙** 及实例是否要求登录后才能访问对应路径。
