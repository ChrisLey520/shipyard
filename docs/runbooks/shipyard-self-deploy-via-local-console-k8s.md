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

### 2.1 若 Ubuntu / k3s 集群里还没有 Postgres、Redis

仓库 **`deploy/k8s/base` 不会自动安装数据库**（`secret.yaml` 里 `postgres:5432`、`redis:6379` 只是示例主机名）。任选一种方式即可：

**方案 A — 云托管（生产更常见）**  
在阿里云 RDS、AWS RDS、Upstash Redis 等创建实例，把 **`DATABASE_URL`、`REDIS_URL`** 改成云厂商给你的连接串（须从 **集群内 Pod 能访问** 的地址：公网、VPC 内网、或托管服务的 K8s 集成端点），再 `kubectl apply -k deploy/k8s/base`（或只 `kubectl apply -f base/secret.yaml` 更新 Secret）。

**方案 B — 集群内用 Helm 自建（单机/学习环境）**  

需已安装 **Helm 4**（示例版本 **v4.1.4**；`helm version` 应显示 `v4`）；若尚未安装，按下面 **§2.2** 操作。**若不想装 Helm**，更省事的是改用 **方案 A（云托管）**；纯手写 `kubectl` 的 StatefulSet/Service 也可，但维护成本高，本 runbook 不展开。

Helm 就绪后，在 **`shipyard`** 命名空间安装 Postgres 与 Redis，然后用 `kubectl -n shipyard get svc` 看 **Service 名称**，把 `secret.yaml` 里的连接串改成与 **实际 Service 名、端口、密码** 一致后再 apply。示例（版本与 chart 以你环境为准，安装后务必核对 `get svc` 与 chart 说明）：

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
kubectl create namespace shipyard --dry-run=client -o yaml | kubectl apply -f -
helm install postgres bitnami/postgresql -n shipyard --set fullnameOverride=postgres --set auth.database=shipyard --set auth.postgresPassword='请改为强密码'
helm install redis bitnami/redis -n shipyard --set architecture=standalone --set fullnameOverride=redis --set auth.password='请改为强密码'
```

**若 `helm install` 报错类似 `registry-1.docker.io … i/o timeout`（或 `FetchReference` 失败）**  
**Helm 4** 安装 Bitnami 等 chart 时，仍会从 **Docker Hub**（`registry-1.docker.io`）拉取 **OCI chart**（与 Helm 3 行为一致），与集群节点能否拉业务镜像无关；**超时 = 当前这台执行 `helm` 的机器到 Docker Hub 的 HTTPS 不通或极慢**（防火墙、运营商、跨境链路、公司出口策略等）。

可按优先级尝试：

1. **换网络或走代理**（最直接）  
   在 **同一台 Ubuntu** 上先测：`curl -v --connect-timeout 15 https://registry-1.docker.io/v2/`。若这里就超时，给该 shell 配 **`https_proxy` / `http_proxy`**（与浏览器代理一致），再执行 `helm install`。Helm 会继承环境变量里的代理。

2. **在能访问 Docker Hub 的机器上 `helm pull`，再把 chart 包拷到 VM**（离线/弱网常用）  
   下表 **chart 版本**（`helm pull --version` 使用的数字）以 **2026-04-20** 在可联网环境执行 **`helm show chart oci://registry-1.docker.io/bitnamicharts/<name>`** 得到的 **`version:`** 为准，与当时 OCI **默认最新** chart 一致；Bitnami 发版后会变，**维护文档前请重新执行下面两行并同步改 `--version` 与 `.tgz` 文件名**：

   ```bash
   helm show chart oci://registry-1.docker.io/bitnamicharts/postgresql | grep '^version:'
   helm show chart oci://registry-1.docker.io/bitnamicharts/redis | grep '^version:'
   ```

   | Chart（OCI） | 文档更新日查到的 `version` |
   |--------------|---------------------------|
   | `bitnamicharts/postgresql` | **18.5.24** |
   | `bitnamicharts/redis` | **25.3.11** |

   在可访问外网的电脑执行：

   ```bash
   mkdir -p charts && cd charts
   helm pull oci://registry-1.docker.io/bitnamicharts/postgresql --version 18.5.24
   helm pull oci://registry-1.docker.io/bitnamicharts/redis --version 25.3.11
   scp postgresql-18.5.24.tgz redis-25.3.11.tgz ubuntu@你的VM:~/
   ```

   **`helm pull` 得到的是什么、能不能「把本机装好的复刻到 Ubuntu」**  
   - 产物是 **Helm chart 的 `.tgz` 包**（YAML 模板、默认 values 等），**不是**「本机已经跑起来的 Postgres 数据目录」之类整机拷贝；也**不是**在本地执行一遍就等于 Ubuntu 上已安装好数据库。  
   - **`helm install` 作用在 Kubernetes 集群**：把 Release 写进集群、创建 Deployment/Service 等。执行 `helm install` 的机器必须 **能用当前 `kubectl`/`KUBECONFIG` 连上你的 k3s**。常见两种做法等价：  
     - **在 Ubuntu 上** `helm install … ~/postgresql-…tgz`（先把 chart 拷过去）：Ubuntu **不必再访问 Docker Hub 下载 chart**；或  
     - **在你本地电脑** 若已配置 **同一 kubeconfig 且能访问远端 API**，可直接 **`helm install … ./postgresql-…tgz`**，**不必 scp**，安装结果仍在 **远端集群** 里。  
   - **注意**：chart 装上后，**集群节点** 仍要为 Pod **拉取 `docker.io/bitnami/…` 运行时镜像**（与 chart 离线是两回事）；若节点拉镜像也失败，仍需 **containerd 镜像加速 / 代理** 或换 **方案 A（云托管）**。

   在 VM 上（若你本地 `helm pull` 得到的文件名与版本号不同，以实际文件名为准）：

   ```bash
   helm install postgres ~/postgresql-18.5.24.tgz -n shipyard --set fullnameOverride=postgres --set auth.database=shipyard --set auth.postgresPassword='你的密码'
   helm install redis ~/redis-25.3.11.tgz -n shipyard --set architecture=standalone --set fullnameOverride=redis --set auth.password='你的密码'
   ```

   若只想拉「当前默认最新」而不手写版本号，可省略两条 `helm pull` 的 **`--version …`**（生成的 `.tgz` 名会随 registry 变化）。OCI chart **不依赖** `helm repo add bitnami`；若仍用传统 repo 安装，再用 `helm search repo bitnami/postgresql -l` 查版本。VM 上安装 **不必**再访问 Docker Hub。

3. **不用 Helm、改用云托管（方案 A）**  
   若长期无法稳定访问 Docker Hub，在腾讯云 RDS / Redis 等开实例，把 `DATABASE_URL`、`REDIS_URL` 指到云厂商地址（须保证 **集群内 Pod 能访问**），可完全避开本问题。

#### 2.1.1 若前面已按「国内镜像」配置（与 Helm 的关系）

很多人先在 [ubuntu-zero-to-k3s-single-node.md](./ubuntu-zero-to-k3s-single-node.md) **§4.2** 用 **`INSTALL_K3S_MIRROR=cn`** 装 k3s，或为 **Docker / k3s containerd** 配了 **`registry-mirrors` / `registries.yaml`**（本文 §9 故障表里「拉 `node:20-alpine`」那类加速）。需要分清 **三件事互不替代**：

| 配置 | 主要作用 | 是否让 `helm install bitnami/postgresql` 自动走国内源 |
|------|----------|--------------------------------------------------------|
| **`INSTALL_K3S_MIRROR=cn` + 国内 k3s 安装脚本** | 装 k3s 时拉 **k3s 二进制与安装依赖** | **否** |
| **Docker `daemon.json` / containerd `registries.yaml` 对 `docker.io` 的镜像加速** | **`docker pull`**、**构建时拉基础镜像**、**集群内 Pod 拉业务镜像** | **否**（Helm 拉的是 **OCI chart 元数据**，默认仍访问 **`https://registry-1.docker.io`**，不读 Docker 的 mirror 配置） |
| **Helm 自身** | 下载 **chart 包**（OCI 或 `helm repo`） | 需单独处理：见上表 **1～3**（`https_proxy`、离线 `.tgz`、云托管） |

**因此：后续 Helm 仍按 §2.1 原文操作**——`helm repo add …`、`helm install …` 与你在节点上配的 **Docker 国内镜像没有自动联动**。若本机 `curl -v --connect-timeout 15 https://registry-1.docker.io/v2/` 仍超时，请对该 shell 设置 **`export https_proxy=http://主机:端口`**（或 `HTTP_PROXY`/`HTTPS_PROXY`，视代理要求）后再执行 `helm install`；或改用 **离线 `helm pull` + `scp` + `helm install … ~/chart.tgz`**（见上 **第 2 条**）。

**安装成功之后**：Helm chart 会调度 Pod，Pod 拉 **Bitnami 运行时镜像**（如 `docker.io/bitnami/postgresql:…`）时，才会用到你在 **containerd / Docker** 上配的 **镜像加速**——那是 **运行阶段**，与 **Helm 下载 chart 包**是两步；前面 chart 都装不上时，先解决 Helm 侧网络或离线包。

**与上述两条 `helm install` 的对应关系（把命令里的「请改为强密码」换成你自己设的密码，两处可不同）：**

| 组件 | 用户名 | 密码 | 库名 / DB |
|------|--------|------|-----------|
| **PostgreSQL**（`helm install postgres …`） | **`postgres`**（Bitnami 默认超级用户；未设置 `auth.username` 时） | **`auth.postgresPassword`** 里你写的那个字符串 | **`auth.database`**，上例为 **`shipyard`** |
| **Redis**（`helm install redis …`） | URL 里一般 **不写用户名**（空用户名） | **`auth.password`** 里你写的那个字符串 | Redis 逻辑库常用 **`0`**（URL 末尾可写 `/0`） |

写入 `deploy/k8s/base/secret.yaml` 时（`stringData` 下），示例（密码替换为你 `helm install` 里设的值；主机名以 `kubectl -n shipyard get svc` 为准）：

```yaml
  DATABASE_URL: "postgresql://postgres:<与 auth.postgresPassword 相同>@postgres:5432/shipyard"
  REDIS_URL: "redis://:<与 auth.password 相同>@redis-master:6379/0"
```

若 `get svc` 里名称不是 `postgres` / `redis-master`，只替换 **@ 后面、端口前** 的那段主机名即可。Chart 升级后字段名可能变化，以 `helm show values bitnami/postgresql`、`helm show values bitnami/redis` 为准。

#### 2.1.2 `helm install` 之后如何检测是否安装成功

在 **已配置好 `kubectl`、且默认 Namespace 或 `-n shipyard` 指向安装目标集群** 的机器上执行（Release 名与下文一致时为你示例里的 **`postgres` / `redis`**；若你安装时改过名字，把命令里的 Release 名换成 `helm list` 里的）：

1. **Helm 层：Release 是否为 deployed、无失败 hook**  

   ```bash
   helm list -n shipyard
   helm status postgres -n shipyard
   helm status redis -n shipyard
   ```

   `STATUS` 应为 **`deployed`**；`helm status` 末尾若有 **测试 Job / hook** 失败，按输出里的 Pod 名 `kubectl logs` 排查。

2. **Kubernetes 层：Pod 是否 Running、Service 是否有 Endpoints**  

   ```bash
   kubectl get pods,svc -n shipyard
   kubectl get endpoints -n shipyard
   ```

   与 Postgres / Redis 相关的 **Pod** 应为 **`Running`**，**READY** 如 **`1/1`**（主从架构时可能多 Pod，以 chart 为准）；**Endpoints** 里应对应 **有 IP:端口**，不能长期为空（否则 Service 无后端）。

3. **（可选）Chart 自带测试**  

   Bitnami 常见 chart 提供 **`helm test`**，可再跑一层冒烟：

   ```bash
   helm test postgres -n shipyard
   helm test redis -n shipyard
   ```

   若集群策略禁止 hook Pod 或测试失败，以第 2 步 **Pod 日志** 为准：`kubectl logs -n shipyard <pod 名> --tail=100`。

4. **（可选）从集群内连一下库**  
   用临时 Pod 或已有应用 Pod，对 **`kubectl get svc -n shipyard` 里 Postgres/Redis 的 ClusterIP 与端口** 做 `psql` / `redis-cli PING`（具体镜像与命令按你环境选择即可）。

若 **ImagePullBackOff / Pending** 长期存在，多半是 **节点拉不下 `docker.io/bitnami/…` 镜像**（与 chart 已安装成功不同步），需回到 **containerd 镜像加速 / 代理** 或 **方案 A**。

**方案 C — 仍在 Ubuntu 上用 Docker 跑数据库、不进 k8s**  
也可在节点本机 `docker compose` 起 Postgres/Redis，但 Pod 内访问需使用 **节点 IP + 宿主机端口** 或自建 **NodePort/ExternalName**，网络与防火墙要自己打通，不如方案 B 省心。

### 2.2 安装 Helm 4（Ubuntu / Linux）

用于 **§2.1 方案 B**（在集群内用 chart 安装 Postgres / Redis）。要求：本机已能执行 `kubectl` 且能连上目标集群。

**方法一：官方安装脚本（推荐，版本新）**

1. 若无 `curl`，先安装：

   ```bash
   sudo apt update && sudo apt install -y curl
   ```

2. 下载并执行 Helm 官方安装脚本（脚本在仓库中历史文件名为 **`get-helm-3`**，可同时用于安装 **Helm 4**；**务必传入 `--version v4.1.4`**（或你需要的其它 `v4.x.x`），否则脚本默认可能仍解析为 Helm 3 系「最新」标签）。安装结果写入 **`/usr/local/bin/helm`** 时通常需 `sudo`：

   ```bash
   curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash -s -- --version v4.1.4
   ```

   **若第 2 步长时间无输出、像「卡住」**：多半是在连 **GitHub**（`raw.githubusercontent.com`）下载脚本或后续从 **get.helm.sh** 拉二进制时 **网络慢、被墙、需代理或 DNS 异常**。可先 **Ctrl+C** 中断，再按需尝试：

   - **看卡在哪**：`curl -v --connect-timeout 15 --max-time 120 -o /tmp/get-helm-3.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3`，若这里就卡住，说明到 GitHub 不通，需换网络、配 **HTTPS 代理**（`export https_proxy=...`）或由能访问外网的机器下载后拷到服务器。
   - **分步执行**：先 `curl ... -o /tmp/get-helm-3.sh`，再 `bash /tmp/get-helm-3.sh --version v4.1.4`，便于确认是「下载」还是「安装」阶段慢。
   - **绕过该脚本**：改用下面 **方法二（Snap）**；或到 [Helm Releases](https://github.com/helm/helm/releases) 下载对应 Linux 的 `helm-v4.1.4-linux-amd64.tar.gz`（架构须与服务器一致，ARM 用 `arm64`），解压后将 `helm` 拷到 `PATH` 下（如 `/usr/local/bin/`）并 `chmod +x`。

3. 让 shell 识别刚安装的 `helm`：在同一终端 **输入 `hash -r` 后按回车**（bash/zsh 会刷新命令路径缓存），**或**直接新开一个终端窗口；然后校验：

   ```bash
   helm version
   ```

**方法二：Snap（命令少，chart 兼容性一般足够）**

```bash
sudo snap install helm --classic
helm version
```

若 Snap 默认通道仍为 Helm 3，可 **`snap info helm`** 查看是否提供 **4.x** 通道，或优先用 **方法一** 固定 **`v4.1.4`**。

**装好后（供方案 B 继续用）**

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

更全的安装方式见 Helm 官方文档：[Installing Helm](https://helm.sh/docs/intro/install/)。

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
