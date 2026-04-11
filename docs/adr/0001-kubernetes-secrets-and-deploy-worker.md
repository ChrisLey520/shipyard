# ADR 0001：Kubernetes 凭据面与 Deploy Worker 上的 kubectl 权限

## 状态

已采纳（v0.7.0）

## 背景

Shipyard 支持在 `releaseConfig.executor === 'kubernetes'` 时，由 **Deploy Worker** 使用本机 **`kubectl`** 对目标集群执行 `set image` 与 `rollout status`。集群连接与镜像拉取依赖两类敏感材料：

- **kubeconfig**（组织级 `KubernetesCluster`，服务端加密存储）
- **容器镜像仓库凭据**（构建/推送阶段由流水线与宿主环境决定，不在本 ADR 展开）

## 决策

1. **kubeconfig 不落盘为长期文件**：部署任务将解密后的 kubeconfig 写入 **临时文件**（如 `/tmp/shipyard-kube-<deploymentId>.yaml`），任务结束后删除；降低多租户与共享 Worker 上的残留风险。
2. **Worker OS 用户即 kubectl 身份边界**：能启动 Deploy Worker 的 OS 用户应视为可触达 kubeconfig 所授权的所有 API 资源；**不按部署任务做 Linux 级沙箱**（与当前 SSH 路径一致，由运维隔离 Worker）。
3. **集群侧 RBAC 由客户负责**：Shipyard 只执行 `kubectl` 子集；建议在目标命名空间绑定 **最小 Role**（如仅 `deployments`、`pods` 的 get/list/watch/patch 及 `rollouts` 相关），避免使用集群管理员 kubeconfig。
4. **镜像拉取**：依赖集群内 `imagePullSecrets` 或节点已登录的 registry；Shipyard 推送镜像时使用构建环境的 Docker 凭据，与 kubeconfig 正交。

## 后果

- Worker 主机需安装 **`kubectl`** 且网络可达 API Server；kubeconfig 内嵌的 CA/证书由客户维护轮换。
- 合规场景应在独立、受控的 Worker 上运行 K8s 部署队列，并对磁盘与内存中的临时 kubeconfig 做主机级加密或加固（产品层不替代主机安全基线）。

## 相关代码

- `DeployApplicationService.performKubernetesRollout`：临时 kubeconfig 文件与 `kubectl` 调用。
- `KubernetesClustersApplicationService`：kubeconfig 解密与组织隔离。
