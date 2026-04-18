# 通过本地 Shipyard 控制台将 Shipyard 部署到 Kubernetes（含 Web / Server / Worker）

本文说明：在本地已运行 Shipyard（含一键登录、已登记 Ubuntu 服务器、GitHub 账户、Kubernetes 集群）的前提下，**使用管理后台 UI** 配置项目与环境，驱动构建与 **Kubernetes 滚动发布**，将 **Server** 与 **Worker** 更新到远端集群；并说明 **Web** 镜像与当前流水线的关系。

> 实现依据：仓库内 `apps/web` 环境弹窗与项目设置、`apps/server` 中 `DeployApplicationService.performKubernetesRollout`、`BuildWorkerService.pushBuiltImageToRegistry`，以及 `deploy/k8s/` 清单。

---

## 1. 行为与约束（必读）

### 1.1 `kubectl` 运行在何处

Kubernetes 发布步骤在 **运行 Shipyard Deploy Worker 的进程** 内执行本机 `kubectl`（`execLocal`），**不是**在环境中所选 SSH 服务器的 shell 里执行。

- **本地开发**：Server 与 Worker 通常跑在你的 **本机** → `kubectl` 使用组织里登记的 kubeconfig，**必须在本机能直连 API Server**。
- kubeconfig 中若为 `https://127.0.0.1:6443` 且仅在 Ubuntu 上有效，**在本机执行会失败**。请改为 Ubuntu 的 **局域网 IP / 公网 IP / VPN 内地址** 等，并在本机验证 `kubectl get nodes`。

### 1.2 容器镜像与 Dockerfile

启用「构建后推送镜像」后，Worker 在克隆的仓库根目录执行 **`docker build -t … .`**，即使用 **仓库根目录 `Dockerfile`**。该文件构建的是 **API Server 与 Worker 共用镜像**（K8s 中 Worker Deployment 通过 `command` 区分）。

**管理后台（Web）** 对应 **`apps/web/Dockerfile`**，**不会**被根目录单次 `docker build .` 构建。集群中 `shipyard-web` 的镜像需 **单独构建推送** 或通过其他流程更新（见第 8 节）。

### 1.3 环境表单与 K8s

「新建/编辑环境」弹窗在 **执行器为 Kubernetes** 时，仍 **必须** 选择 **服务器** 并填写 **部署路径**（前端校验）。K8s 路径下 **不使用 SSH 同步产物**，部署路径可填 **占位绝对路径**（如 `/opt/shipyard/k8s-placeholder`）。

### 1.4 `clusterId` 与 `namespace`

`kubernetes.clusterId`、`kubernetes.namespace` 等需落在 **`releaseConfig` JSON** 中。组织设置页集群列表 **只显示名称**，**不显示 UUID**。登记成功后可在浏览器 **开发者工具 → Network** 中查看 `POST/GET .../kubernetes-clusters` 响应体中的 **`id`**。

### 1.5 发布策略

Kubernetes 执行器仅支持 **`direct`** 与 **`rolling`**，不支持 **蓝绿**、**金丝雀**（服务端会拒绝）。

---

## 2. 前置条件清单

| 项目 | 说明 |
|------|------|
| 本地 Shipyard | Web + API + Redis/Postgres 已可用；**Build Worker 与 Deploy Worker 已运行**（与日常开发一致即可）。 |
| Docker | Worker 机器上 `docker info` 正常，用于 `docker build` / `docker push`。 |
| kubectl | Worker 机器已安装，且用登记用的 kubeconfig 可访问目标集群。 |
| 镜像仓库 | 如 GHCR / Harbor / ACR；集群节点可拉取推送后的镜像。 |
| 集群内基线 | 已按 `deploy/k8s` 完成首次 `kubectl apply -k ...`，存在 `shipyard-server`、`shipyard-worker`、`shipyard-web` 等 Deployment；Secret/ConfigMap 已配置。可参考同目录下 [ubuntu-zero-to-k3s-single-node.md](./ubuntu-zero-to-k3s-single-node.md)。 |

---

## 3. 组织设置：登记 Kubernetes 集群

1. 浏览器打开本地管理端（如 `http://localhost:5173`）。
2. 左侧菜单点击 **「组织设置」**（路径：`/orgs/{orgSlug}/settings`）。
3. 在卡片 **「Kubernetes 集群（环境 releaseConfig 引用）」** 中：
   - 点击 **「登记集群」**。
   - 弹窗 **「登记 Kubernetes 集群」**：
     - **名称（组织内唯一）**：例如 `prod-k3s`。
     - **Kubeconfig 全文**：粘贴已在「Worker 机器可访问 API」前提下修正后的 YAML。
   - 点击 **「保存」**。
4. 在开发者工具 Network 中查看接口响应，**复制集群 `id`（UUID）**，供下文 `clusterId` 使用。

---

## 4. 新建项目并绑定仓库

1. 左侧 **「项目」** → ` /orgs/{orgSlug}/projects`。
2. 点击 **「新建项目」**。
3. **第一步**：项目名称、URL 标识（slug）、选择 GitHub **仓库**、选择已绑定的 **Git 账户**；框架类型可先选 **「静态站点」**（K8s 执行器不依赖 SSH 静态逻辑）。
4. **第二步**（与 monorepo 及根 `Dockerfile` 一致）建议示例：
   - **安装命令**：`pnpm install --frozen-lockfile`
   - **构建命令**：`pnpm build:server-worker`（或等价地构建 shared + server）
   - **输出目录**：`apps/server/dist`（须为构建后真实存在的目录，以满足流水线打包校验）
   - **Node.js 版本**：`20`（与根 `Dockerfile` 一致）
5. 点击 **「创建项目」**。

---

## 5. 项目设置：开启容器镜像与 Registry

1. 进入该项目 → 顶部 **「设置」** Tab。
2. 在 **「项目配置」** 中展开 **「容器镜像（Kubernetes 部署）」**：
   - 打开 **「构建后推送镜像」**。
   - **镜像名（无 tag）**：例如 `ghcr.io/<org>/shipyard-server`（**不要**带 tag；部署时由系统生成 tag）。
   - **Registry 用户 / 密码**：按仓库要求填写（私有仓库需要）。
3. 点击 **「保存」**。

说明：保存时密码仅在有值时上传；后续修改可留空密码以保留原凭据。

---

## 6. 环境：Kubernetes 执行器与 releaseConfig

1. 项目内顶部 **「环境」** Tab → **「添加环境」**。
2. **新建环境**弹窗字段建议：

| 字段 | 建议值 / 说明 |
|------|----------------|
| 环境名称 | 如 `production` |
| 触发分支 | 如 `main` |
| 服务器 | **任选已登记的一台**（满足必选；K8s 下不传产物） |
| 部署路径 | 占位路径，如 `/opt/shipyard/k8s-placeholder` |
| 域名 | 可选；Ingress 对外域名，用于界面展示 |
| 健康检查 URL | **须从 Worker 机器可访问**，如 `https://<你的域名>/api/healthz` |
| 受保护 | 首次建议 **关闭**（否则需审批后才能部署） |
| 执行器 | **Kubernetes** |
| 发布策略 | **direct（直连）** 或 **rolling（滚动/多机）** |
| 主 Deployment 名称 | `shipyard-server`（与 `deploy/k8s/base/server.deployment.yaml` 一致） |
| 主容器名称 | `server`（与 Pod 模板 `containers[].name` 一致） |
| 同镜像额外 Deployment | 点击 **「+ 添加 Deployment」**：`shipyard-worker` / `worker` |

3. **发布配置 (JSON)**：在文本框粘贴。`namespace` 与集群中实际一致，默认可为 `shipyard`。

   **`clusterId` 必须是合法 UUID 字符串**（形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 的 36 字符，含连字符），取自 **第 3 节步骤 4** 登记集群后接口响应里的 **`id`**。组织设置列表里只看到**名称**，填名称会报错；保留中文说明或非 UUID 会报 `releaseConfig 无效: … "path":["kubernetes","clusterId"] … Invalid uuid`。

   下面示例里的 `clusterId` 仅为**格式示意**，保存前须换成你在 Network 里复制的真实 `id`；若误留示例值，下一步校验会报「Kubernetes 集群不存在或不属于当前组织」。

```json
{
  "executor": "kubernetes",
  "strategy": "direct",
  "kubernetes": {
    "namespace": "shipyard",
    "clusterId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "deploymentName": "shipyard-server",
    "containerName": "server",
    "additionalDeployments": [
      { "deploymentName": "shipyard-worker", "containerName": "worker" }
    ]
  }
}
```

表单中的主 Deployment / 主容器 / 额外 Deployment 会与 JSON **合并**保存；保持与清单一致即可。

4. 点击 **「创建」**。编辑已有环境时使用 **「编辑」** → **「保存」**。

---

## 7. 触发部署与验收

1. **「环境」** Tab 中，对应环境卡片点击 **「立即部署」**。
2. 进入 **部署详情**页（路径形如 `/orgs/{orgSlug}/projects/{projectSlug}/deployments/{deploymentId}`），查看构建与部署日志。
3. 成功时日志中通常可见：
   - `[container] docker build`、`docker push`、`[container] 已推送 …`
   - `[deploy] executor=kubernetes`、`k8s set-image`、`k8s rollout status`
   - 若配置了健康检查 URL：`健康检查通过`、`部署成功`
4. 在集群侧验证：

```bash
kubectl -n shipyard get deploy,pods
```

确认 `shipyard-server`、`shipyard-worker` 镜像已更新。

---

## 8. Web（shipyard-web）说明

当前流水线 **仅** 构建根目录 `Dockerfile`（Server/Worker）。**Web** 需单独处理，例如在本机或 CI：

```bash
docker build -f apps/web/Dockerfile -t <registry>/shipyard-web:<tag> .
docker push <registry>/shipyard-web:<tag>
kubectl -n shipyard set image deployment/shipyard-web web=<registry>/shipyard-web:<tag>
kubectl -n shipyard rollout status deployment/shipyard-web
```

更多清单说明见仓库 **`deploy/k8s/README.md`**。

---

## 9. 故障对照

| 现象 | 排查方向 |
|------|----------|
| `namespaces "shipyard" not found`（或你配置的其它名字） | 集群里尚未创建该 Namespace。执行 `kubectl create namespace <名字>`，或先 `kubectl apply -k deploy/k8s/base`（`base/namespace.yaml` 默认名为 `shipyard`）；环境 **发布配置 JSON** 里的 `kubernetes.namespace` 必须与集群一致 |
| `deployments.apps "shipyard-server" not found` 等 | 命名空间已有，但 **未 apply 过清单** 或 **Deployment 名称不一致**。在集群执行 `kubectl apply -k deploy/k8s/base`（或你的 overlay）；控制台里主 Deployment / 额外 Deployment 名称须与 `deploy/k8s/base/*.deployment.yaml` 里 `metadata.name` 一致（默认可为 `shipyard-server`、`shipyard-worker`） |
| kubectl 连不上 API | kubeconfig 中 `server` 是否在 **Worker 机器** 上可达 |
| `auth.docker.io` / `oauth token` / `EOF`（拉 `node:20-alpine` 失败） | Docker Hub 在本机或构建机网络不可达。可为 Docker 配置 **registry 镜像加速**，或在 **Worker** 环境设置 `SHIPYARD_CONTAINER_BASE_IMAGE` 为可拉取的 Node 20 Alpine 镜像（与根 `Dockerfile` 中 `ARG NODE_IMAGE` 对应），例如云厂商提供的 `docker.io/library/node` 同步地址；`docker-compose.yml` 的 `worker` 服务已预留该变量 |
| 提示需要 imageRef / 镜像推送 | 是否打开「构建后推送镜像」、镜像名与 Registry 凭据是否正确、Docker 是否可用 |
| 校验失败：集群不存在 | `clusterId` 是否属于当前组织、是否复制错误 |
| 主 Deployment / 容器名错误 | 与 `deploy/k8s/base/*.deployment.yaml` 中 **metadata.name** 与 **containers[].name** 完全一致 |
| 健康检查失败 | URL 是否可从 Worker 机器访问；Ingress / 证书是否就绪 |

---

## 10. 相关文件索引

| 路径 | 作用 |
|------|------|
| `deploy/k8s/README.md` | Kustomize 结构、Secret、Ingress、`releaseConfig` 示例 |
| `deploy/k8s/base/server.deployment.yaml` | Server Deployment / 容器名 `server` |
| `deploy/k8s/base/worker.deployment.yaml` | Worker Deployment / 容器名 `worker` |
| `deploy/k8s/base/web.deployment.yaml` | Web Deployment / 容器名 `web` |
| `Dockerfile`（仓库根） | 流水线 `docker build .` 使用的 Server+Worker 镜像 |
| `apps/web/Dockerfile` | 管理后台静态镜像（需单独构建） |

---

文档版本：与 Shipyard 仓库实现同步编写；若 UI 文案或路由微调，以实际界面为准。
