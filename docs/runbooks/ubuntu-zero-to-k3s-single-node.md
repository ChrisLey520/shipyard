# 零基础：把一台 Ubuntu 服务器变成「单机 Kubernetes 集群」（意思 A）

> 适用：只有 **一台** 云服务器或物理机，系统为 **Ubuntu**，登录用户为 **`ubuntu`**，可使用 **`sudo`**。  
> 目标：在这台机器上安装 **k3s**（轻量 Kubernetes），得到 **`kubectl`** 和 **kubeconfig**，供后续在 **Shipyard** 里登记、部署应用（如 `server`/`worker` 镜像滚动）。  
> 本文 **不** 替代官方文档；安装命令以 [k3s.io](https://docs.k3s.io/) 为准，若官方有更新请以官网为准。

---

## 0. 先搞懂几个词（1 分钟）

| 词 | 白话 |
|----|------|
| **Kubernetes（K8s）** | 在机器上**按声明跑容器**的平台；你写「要跑什么镜像、要几份」，它负责拉起、重启、滚动升级。 |
| **节点（Node）** | 参与跑容器的那台（或多台）机器。单机时：**这一台 Ubuntu 既是「控制大脑」又是「干活的工人」**。 |
| **k3s** | Rancher 出的 **小型 K8s 发行版**，适合 1 台服务器，安装简单，自带 `kubectl`。 |
| **kubeconfig** | 一个 YAML 文件，里面有 **集群地址 + 证书/令牌**；`kubectl` 靠它知道「连哪、用什么身份」。 |
| **Registry（镜像仓库）** | 存 Docker 镜像的地方（如 Docker Hub）。**真正跑 Shipyard 滚镜像时还需要**，本文末尾会说明下一步。 |

---

## 1. 登录服务器

在你自己的电脑上打开终端，用 SSH 登录（把 `你的服务器IP` 换成真实 IP 或域名）：

```bash
ssh ubuntu@你的服务器IP
```

第一次连接会问 `yes/no`，输入 `yes`。若使用密钥登录，确保本机已加载对应私钥。

---

## 2. 更新系统（推荐）

```bash
sudo apt update
sudo apt upgrade -y
```

可选：查看 Ubuntu 版本：

```bash
lsb_release -a
```

建议使用 **Ubuntu 22.04 LTS** 或 **24.04 LTS**。

---

## 3. 硬件与 Swap（避免安装失败）

**建议**：至少 **2 vCPU、4GB 内存**；若只有 2GB，可能勉强能跑 k3s，但再跑 Shipyard 的 API/Worker/数据库会很紧。

若 **没有 Swap** 且内存较小，可加 2G Swap（可选）：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. 安装 k3s（单机「集群」）

在服务器上执行一键安装脚本。默认脚本地址 **`https://get.k3s.io`** 会从 **GitHub Releases** 拉取二进制与校验信息；在 **中国大陆** 公网环境下常出现 **长时间无输出、超时或卡住**，此时请直接用下面 **「4.2 国内镜像」** 中的命令，不必死等官方源。

**若你打算从笔记本用公网 IP 连 API（第 7 节）**，安装时建议把 **公网 IP**（或域名）加入 API 证书 **TLS SAN**，否则本机 `kubectl` 可能报 **`x509: certificate is valid for 127.0.0.1, not 你的IP`**。把下面 `你的公网IP` 换成真实 IP（或再加 `--tls-san 你的域名`）。

### 4.1 官方源（网络畅通时）

```bash
curl -sfL https://get.k3s.io | sh -s - server --tls-san 127.0.0.1 --tls-san 你的公网IP
```

若暂时只在 **服务器本机** 用 `kubectl`，可先用最简安装（以后再改证书需运维成本更高）：

```bash
curl -sfL https://get.k3s.io | sh -
```

### 4.2 国内镜像（中国大陆推荐）

Rancher 提供面向国内的 **安装脚本镜像**，并通过环境变量 **`INSTALL_K3S_MIRROR=cn`** 让脚本从 **国内镜像** 下载 k3s 相关文件，避免直连 GitHub。

**脚本地址（二选一；若其一报错可换另一个）：**

| 说明 | URL |
|------|-----|
| Rancher 中国站脚本 | `https://rancher-mirror.rancher.cn/k3s/k3s-install.sh` |
| 阿里云 OSS 上的同名脚本（备用） | `https://rancher-mirror.oss-cn-beijing.aliyuncs.com/k3s/k3s-install.sh` |

**带公网 IP 的 TLS SAN（与 4.1 行为一致，仅换脚本与镜像变量）：**

```bash
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn sh -s - server --tls-san 127.0.0.1 --tls-san 你的公网IP
```

**本机仅用 kubectl 的最简安装：**

```bash
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn sh -
```

**固定 k3s 版本（可选）**：将 `v1.30.5+k3s1` 换成你需要的 [Release 版本号](https://github.com/k3s-io/k3s/releases)（镜像会同步，具体延迟以镜像站为准）：

```bash
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn INSTALL_K3S_VERSION=v1.30.5+k3s1 sh -s - server --tls-san 127.0.0.1 --tls-san 你的公网IP
```

更多环境变量见 [Rancher 文档：k3s 安装选项](https://docs.rancher.cn/docs/k3s/installation/install-options/)（与官方 `INSTALL_K3S_*` 一致）。若镜像脚本返回 **403**、超时或内容异常，可换用上表 **备用 OSS 脚本 URL** 再执行同一管道命令。

---

等待安装结束。脚本会安装：

- `k3s` 服务（systemd）
- 内置 **containerd** 容器运行时
- **API Server**（默认监听 **6443**）

检查服务是否运行：

```bash
sudo systemctl status k3s
```

看到 **active (running)** 即正常。按 `q` 退出状态页。

---

## 5. 用 kubectl 看节点（验证集群）

k3s 自带 `kubectl`，通过 `k3s kubectl` 调用：

```bash
sudo k3s kubectl get nodes
```

应看到 **一行** `Ready`，`ROLES` 里可能有 `control-plane` 或 `master`。  
单机时 **控制面与工作负载可以在同一节点**；若你发现 **业务 Pod 一直 Pending**，到文末「常见问题」看 **污点（taint）** 一节。

---

## 6. 把 kubeconfig 拷到 ubuntu 用户家目录（方便你操作）

默认管理员配置在 **root** 下，每次 `sudo` 不方便。建议复制一份给 `ubuntu` 用户：

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown ubuntu:ubuntu ~/.kube/config
chmod 600 ~/.kube/config
```

设置环境变量（当前会话生效）：

```bash
export KUBECONFIG=~/.kube/config
kubectl get nodes
```

若 `kubectl` 提示找不到命令，用完整路径或安装客户端包（可选）：

```bash
sudo ln -sf /usr/local/bin/k3s /usr/local/bin/kubectl
# 或：sudo apt install -y kubectl   # 版本可能与 k3s 不一致，优先用 k3s 自带的
```

再试：

```bash
kubectl get nodes
```

---

## 7. 从「你自己的电脑」远程管理这台集群（重要）

服务器上的 `~/.kube/config` 里，**默认 API 地址是 `https://127.0.0.1:6443`**。这只在 **服务器本机** 有效。

要在 **笔记本** 上用 `kubectl` 或让 **Shipyard（跑在你电脑上）** 连集群，需要：把配置拷到本机、把 `server` 改成公网可达地址、放行 **6443**，并在本机安装 `kubectl`。下面用命令行完成（**不要**把 kubeconfig 提交到公网仓库或聊天里）。

**约定变量**（在终端里先导出，后面命令直接粘贴即可）：

```bash
# 服务器 SSH 登录名与地址（把值换成你的）
export SSH_USER="ubuntu"
export SSH_HOST="你的服务器公网IP或域名"

# 写入 kubeconfig 里 clusters[].cluster.server 的地址（一般用弹性公网 IP）
export KUBE_API_HOST="你的服务器公网IP"

# 本机保存路径（可改）
export LOCAL_KUBECONFIG="$HOME/k3s-config"
```

### 7.1 从服务器复制 `~/.kube/config` 到本机

在你**自己的电脑**上执行：

```bash
scp "${SSH_USER}@${SSH_HOST}:~/.kube/config" "${LOCAL_KUBECONFIG}"
```

### 7.2 把 `https://127.0.0.1:6443` 改成公网地址

**先备份**，再用 `sed` 替换（`server` 里只允许出现一个 `127.0.0.1:6443` 时，一条命令即可）。

**Linux（GNU `sed`，常见 Ubuntu / Debian 桌面）：**

```bash
cp "${LOCAL_KUBECONFIG}" "${LOCAL_KUBECONFIG}.bak"
sed -i "s|https://127.0.0.1:6443|https://${KUBE_API_HOST}:6443|g" "${LOCAL_KUBECONFIG}"
```

**macOS（BSD `sed`，`-i` 需要空字符串参数）：**

```bash
cp "${LOCAL_KUBECONFIG}" "${LOCAL_KUBECONFIG}.bak"
sed -i '' "s|https://127.0.0.1:6443|https://${KUBE_API_HOST}:6443|g" "${LOCAL_KUBECONFIG}"
```

若你更习惯用**弹性 IP / 域名**，且 **TLS 证书里包含该主机名**（安装 k3s 时用了 `--tls-san`），可把 `KUBE_API_HOST` 设为域名，例如 `export KUBE_API_HOST="k3s.example.com"`，再执行对应平台的 `sed`。

也可用编辑器手动改：打开本机这份文件，在 **`clusters[].cluster.server`** 中把 `https://127.0.0.1:6443` 改成 `https://<公网IP或域名>:6443`。

### 7.3 检查 `server` 是否已改对

```bash
grep -n 'server:' "${LOCAL_KUBECONFIG}"
```

应看到形如 `https://你的公网IP:6443`（或你的域名），不应再出现 `127.0.0.1:6443`。

### 7.4 本机安装 `kubectl`（若尚未安装）

**macOS（Homebrew）：**

```bash
brew install kubectl
kubectl version --client
```

**Linux（包管理器示例，版本可能与集群略有差异；优先与集群大版本接近）：**

```bash
# Debian/Ubuntu 示例（包名与源因发行版而异，按需调整）
sudo apt update && sudo apt install -y kubectl
kubectl version --client
```

也可从 [Kubernetes 官方发行页](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/) 下载与架构匹配的静态二进制。

### 7.5 使用本机这份配置并测试连通

```bash
export KUBECONFIG="${LOCAL_KUBECONFIG}"
kubectl cluster-info
kubectl get nodes
```

能列出 **API 地址** 或 **节点** 即远程连通成功。若需长期生效，可把 `export KUBECONFIG=...` 写入 `~/.zshrc` 或 `~/.bashrc`。

### 7.6 网络与证书说明

1. **云安全组 / 本机防火墙**须 **放行入站 TCP 6443**（仅对你信任的源 IP 放行更安全）；服务器若启用了 `ufw`，见第 **8** 节。
2. 若仍报 **证书与主机名不符**（`x509: certificate is valid for ...`），说明安装时未加 `--tls-san`：需按第 **12** 节卸载后，用第 **4.1 或 4.2** 节带 **`--tls-san`（公网 IP 或域名）** 的方式重装（大陆网络优先 **4.2**）。

---

## 8. 防火墙（若启用了 ufw）

**执行环境**：下面所有 **`ufw` / `sudo` 命令**在 **Ubuntu 服务器**上执行（保持 SSH 登录在该服务器）。**云厂商安全组**在网页控制台里配置，用你**自己的电脑**打开浏览器登录云平台即可，与是否在 Ubuntu 桌面无关。

若 `sudo ufw status` 显示 **active**，至少需要放行 **6443**（API）以及 NodePort 等（若你要用 NodePort 暴露服务）：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 6443/tcp
# 可选：NodePort 默认范围
sudo ufw allow 30000:32767/tcp
sudo ufw enable
```

**注意**：不同云厂商还有「安全组」网页防火墙，**ufw 与安全组都要放行** 才会通。

**ufw 与 Pod 网络**：若开启默认 **deny incoming** 后，集群内 **Pod 无法访问外网** 或 **Service 异常**，多半是防火墙拦了 CNI/转发流量。可先 `sudo ufw disable` 做对比排查，或查阅 [k3s 官方关于 ufw 的说明](https://docs.k3s.io/advanced#firewalls) 按需放行 **Pod ↔ 外网** 所需规则。

---

## 9. 跑一个最小 Pod 验证（可选）

**执行环境**：下面 **`kubectl` 命令**在**已能访问集群 API 的终端**执行。按第 7 节做完远程 kubeconfig 后，一般是**你自己的电脑**；若你只在 **Ubuntu 服务器**本机用默认 `~/.kube/config` 操作，则在服务器上执行亦可（两处二选一即可，不要重复执行两次）。

```bash
kubectl run demo --image=nginx:alpine --restart=Never
kubectl get pods -o wide
kubectl delete pod demo
```

能 **Running** 再删即可。

---

## 10. 和 Shipyard 的关系（你下一步要做什么）

**执行环境**：本节是**说明与规划**，没有必须在 SSH 里粘贴的一串命令。登记集群、粘贴 kubeconfig 在 **Shipyard Web（浏览器，通常在你自己的电脑上）**；构建镜像、`docker push`、编辑 YAML 一般在**你自己的电脑**或 CI；集群里是否已有 Deployment 取决于你在哪台机器对集群执行 `kubectl apply`（多为本机或 CI，也可以是服务器）。

完成本文后，你拥有：

- 一台 Ubuntu 上的 **单节点 k3s 集群**  
- 一份可在 **本机** 使用的 **kubeconfig**（已把 `127.0.0.1` 改成公网 IP）

接下来（不在本文展开细节）：

1. 在 Shipyard **组织设置**里 **登记 Kubernetes 集群**，粘贴 **kubeconfig 全文**。  
2. 准备 **镜像仓库（Registry）**：Shipyard 构建后 `docker push`，集群 `pull`。没有的话可用 **Docker Hub / ghcr.io** 免费档。  
3. 用 **`deploy/k8s`** 或等价 YAML **先在集群里创建** Deployment/Service/Secret（第一次部署）；Shipyard 主要负责 **`kubectl set image` + rollout**。

---

## 11. 常见问题（小白向）

**执行环境速查**：含 **`sudo journalctl` / `ps aux`（在服务器上看 k3s 进程）** 的在 **Ubuntu 服务器**；只含 **`kubectl`** 的在**能连 API 的终端**（完成第 7 节后多为**你自己的电脑**）；纯文字排查项可能同时涉及**云控制台（本机浏览器）**与**服务器/本机终端**。

### Q1：`kubectl get nodes` 显示 NotReady？

**执行环境**：`kubectl` 在**能连 API 的终端**（多为本机）；`journalctl` 在 **Ubuntu 服务器**。

- 等 1～2 分钟再试。  
- 在服务器上：`sudo journalctl -u k3s -f` 看日志是否有报错（磁盘满、时间不同步等）。

### Q2：业务 Pod 一直 Pending，`describe pod` 里有 `NoSchedule` / taint？

**执行环境**：下列命令在**能连 API 的终端**（多为本机；若只在服务器上用 `kubectl` 则在服务器）。

单机 k3s 多数情况可直接调度；若不能，可对节点去掉控制面污点（**仅单机自建学习用**，生产多节点勿乱用）：

```bash
kubectl get nodes -o wide
kubectl describe node 节点名
# 若存在 node-role.kubernetes.io/control-plane:NoSchedule 等，可尝试：
kubectl taint nodes --all node-role.kubernetes.io/control-plane-
```

（具体 taint 名称以 `describe` 为准。）

### Q3：我复制到本机的 kubeconfig 连不上 6443？

**执行环境**：排查在**你自己的电脑**（试 `kubectl`）与**云厂商控制台（浏览器）**上进行；必要时在 **Ubuntu 服务器**上确认 `ufw` / 本机监听（第 8 节）。

- 云安全组是否放行 **6443**。  
- `config` 里地址是否已改为 **公网 IP** 而非 `127.0.0.1`。  
- 家里宽带/运营商是否封端口（较少见）。

### Q4：k3s 和 Docker Compose 能同时装吗？

**执行环境**：概念与规划，**无固定终端**；若两者装在同一台物理机/云主机上，那台机器即 **Ubuntu 服务器**（也是跑 Docker 的那台）。

可以，但 **端口与资源会抢**。若同一台机还要跑 Shipyard 的 `docker compose`，请规划好 **内存与 80/443/6443** 等端口，避免冲突。

### Q5：执行 `curl … get.k3s.io` 后很久没反应，像卡住了？

**执行环境**：安装 `curl | sh` 在 **Ubuntu 服务器**；另开 SSH 看日志也在 **Ubuntu 服务器**。

- 多半是 **访问 GitHub 不畅**（下载二进制或校验信息阻塞）。请改用 **第 4.2 节国内镜像** 重装流程：先按 **第 12 节** 卸载未装完的残留，再用 **`INSTALL_K3S_MIRROR=cn`** 与镜像脚本 URL 安装。  
- 另开一个 SSH 会话执行 `sudo journalctl -u k3s -f` 或 `ps aux | grep curl` 可辅助判断是 **脚本阶段** 还是 **服务已启动后拉镜像**（后者需配置 containerd 镜像加速或离线镜像，与安装脚本不同）。

---

## 12. 卸载 k3s（装错想重来）

**执行环境**：在 **Ubuntu 服务器**上执行（SSH 登录到装了 k3s 的那台机器）。

**会删除集群数据**，慎用：

```bash
sudo /usr/local/bin/k3s-uninstall.sh
```

---

## 参考链接

**执行环境**：任意；通常用**你自己的电脑**打开浏览器阅读即可。

- k3s 官方文档：<https://docs.k3s.io/>  
- k3s 安装选项（中文）：<https://docs.rancher.cn/docs/k3s/installation/install-options/>  
- Shipyard 与 K8s 部署说明：仓库内 `deploy/k8s/README.md`  
- Shipyard ADR（kubectl 与 kubeconfig）：`docs/adr/0001-kubernetes-secrets-and-deploy-worker.md`

---

**总结一句话**：在 **Ubuntu 服务器**上按第 4～6 节装好 k3s（大陆网络优先 **第 4.2 节镜像**），在**你自己的电脑**上按第 7 节把 kubeconfig 改成公网可访问的 API 地址，你就把这台 Ubuntu 变成了 **单机 Kubernetes 集群**，后面才能用 Shipyard 做 **server/worker 镜像滚动**（并配合 Registry）。
