# SSH 金丝雀（Nginx split_clients）运维说明

## 适用条件

- 环境 `releaseConfig`：`executor: "ssh"`，`strategy: "canary"`。
- **不支持** `executor: "kubernetes"` 与 `strategy: "canary"` 同时出现（保存时会校验拒绝）。

## 两种配置方式

### 1. 生成模式（推荐）

在 `ssh` 下配置：

- `nginxCanaryPath`：片段文件绝对路径（如 `/etc/nginx/snippets/myapp-canary.conf`）。
- `canaryPercent`：0–100，进入候选 upstream 的流量比例。
- `nginxCanaryStableUpstream`、`nginxCanaryCandidateUpstream`：与 **主配置里已有** `upstream` 块名称一致（字母/数字/下划线，不以数字开头）。

部署时 Shipyard 会写入包含 `split_clients` 的片段，变量名为 **`$shipyard_canary_pool`**。

主配置示例（`server { ... }` 内）：

```nginx
include /etc/nginx/snippets/myapp-canary.conf;

location / {
    proxy_pass http://$shipyard_canary_pool;
    # 其余 proxy_set_header 等保持不变
}
```

可选：客户端携带请求头 `Shipyard-Canary-Seed`（对应 Nginx 变量 `$http_shipyard_canary_seed`）可参与哈希，便于压测或固定分流；不携带时该段为空。生成逻辑使用 `"${remote_addr}${http_shipyard_canary_seed}"` 作为 `split_clients` 的哈希输入。

### 2. 手写模式

配置 `nginxCanaryPath` 与非空的 `nginxCanaryBody`。**完全采用手写正文**，忽略 `canaryPercent` 与双 upstream 字段（可不填）。

## 行为说明

- **仅入口机**（`primaryServerId` 或第一台）执行片段写入与 `nginx -s reload`；多机时其余机器只做 rsync。
- 写入前若目标文件已存在会先备份；**`nginx -t` 失败**则用备份恢复目标文件并判定部署失败，避免长期留下未 reload 的错误内容。
- 当前流水线仍是 **全量 rsync** 后再改流量；金丝雀语义是 **在已配置好的 stable/canary 两套后端之间按比例分流**，不是自动为「仅部分机器新版本」建模（与蓝绿组合见产品文档 Stretch）。

## 日志关键字

- `[deploy] canary_fragment_generated split_clients`：使用生成片段。
- `[deploy] canary_fragment_manual`：使用手写片段。
- `[deploy] traffic_switch 写入金丝雀 Nginx 片段`：即将原子写入。
