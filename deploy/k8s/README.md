# Kubernetes 部署（Kustomize）

> 目标：把 Shipyard 的 **web/server/worker** 以可复用的方式部署到 Kubernetes。  
> 说明：默认不在集群内创建 Postgres/Redis（推荐使用托管服务）。如需集群内自建，请自行补充 StatefulSet。
## 前置条件

- 已有可用的 Kubernetes 集群
- 已安装 `kubectl`
- 已安装 `kustomize`（或使用 `kubectl apply -k`）
- 已有镜像仓库（例如 GHCR / 阿里云 ACR / Harbor），并能拉取镜像

## 目录结构

- `deploy/k8s/base`：通用基础清单（Deployment/Service/Ingress/PVC/Config/Secret）
- `deploy/k8s/overlays/dev`：示例 overlay（演示如何替换镜像与域名）

## 需要准备的配置

### 1) Secret（强烈建议用外部 Secret 管理）

基础清单里包含了一个 `Secret` 模板：`base/secret.yaml`。  
请至少修改：

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DATABASE_URL`
- `REDIS_URL`

### 2) 镜像

你需要把镜像推送到仓库，并在 overlay 里替换：

- `shipyard-web`（对应 `apps/web/Dockerfile`，nginx 静态站点）
- `shipyard-server`（对应 `apps/server/Dockerfile`，NestJS API）

### 3) 域名与 Ingress

基础清单提供一个 Ingress：

- `/` → `web`
- `/api` → `server`（Nest 全局前缀是 `api`，因此路径匹配用 `/api`）
你需要在 overlay 里替换 `host`，并确保集群已有 Ingress Controller（如 nginx-ingress）。

## 部署（示例）

在仓库根目录执行：

```bash
kubectl apply -k deploy/k8s/overlays/dev
```

查看状态：

```bash
kubectl -n shipyard get pods,svc,ingress
```

健康检查：

- `GET /api/healthz`

## 回滚

```bash
kubectl -n shipyard rollout undo deploy/shipyard-server
kubectl -n shipyard rollout undo deploy/shipyard-worker
kubectl -n shipyard rollout undo deploy/shipyard-web
```

