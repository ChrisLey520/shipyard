# K8s 自动 Traefik Ingress（按 domain 分流）

用 Shipyard 部署 Kubernetes 项目时，可让 Shipyard 在镜像 rollout 成功后，**自动生成 Service + Traefik Ingress**，按环境 `domain` 做域名分流。默认关闭（opt-in），不影响自带路由清单的用户。

## 前提

- 目标集群已安装 **Traefik**（k3s 内置即可），且存在名为 `traefik` 的 IngressClass。
- 目标命名空间中**已存在** Deployment（Shipyard 只负责换镜像 + 生成路由，不创建 Deployment）。
- 该环境已在「环境设置」里填写 **domain**（作为 Ingress 的 host）。
- TLS 复用集群默认证书（Traefik 默认 `TLSStore`）。若要 80→443 跳转，见「集群级跳转」。

## 开启方式

在环境的发布配置里(表单「自动 Traefik Ingress」开关，或直接编辑 `releaseConfig` JSON)：

```jsonc
{
  "executor": "kubernetes",
  "kubernetes": {
    "namespace": "my-app",
    "deploymentName": "my-app-web",
    "containerName": "web",
    "ingress": {
      "enabled": true,
      // 以下均可选，留空取默认值
      "serviceName": "my-app-web-shipyard", // 默认 `<deploymentName>-shipyard`
      "servicePort": 80,                    // Service 对外端口，默认 80
      "targetPort": 8080,                   // 容器端口；留空则从 Deployment 首容器读取
      "path": "/",                          // 默认 /
      "className": "traefik",               // 默认 traefik
      "entrypoints": "websecure"            // Traefik 入口点，默认 websecure
    }
  }
}
```

## Shipyard 会做什么

rollout（`kubectl set image` + `rollout status`）成功后：

1. `kubectl get deployment <deploymentName> -o json` 读取 `spec.selector.matchLabels` 与首容器 `containerPort`。
2. 生成一份 `kind: List`（含 Service + Ingress）：
   - **Service**：`selector` 复用 Deployment 的 matchLabels，`port=servicePort` → `targetPort`。
   - **Ingress**：`ingressClassName: traefik`，注解 `router.entrypoints=<entrypoints>`、`router.tls=true`，`rules[0].host=<环境 domain>`，`path` → 上述 Service。
3. `kubectl apply -n <namespace> -f <临时文件>`，随后清理临时文件。
4. 部署日志输出 `https://<domain>`。

资源带标签 `app.kubernetes.io/managed-by: shipyard`，便于识别与清理。

## 集群级 80→443 跳转（可选，所有项目共享）

让 k3s 内置 Traefik 的 80 入口全局跳转到 443：

```yaml
# kubectl apply -f 一次即可
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    ports:
      web:
        redirectTo:
          port: websecure
```

## 常见问题

- **开启了但环境没填 domain** → 部署报错，提示填写 domain 或关闭自动 Ingress。
- **`no matches for kind "Ingress"` / IngressClass 不存在** → 集群未装 Traefik 或类名不同；装好 Traefik，或用 `kubernetes.ingress.className` 指定实际类名。
- **Service/Ingress 已存在冲突** → `serviceName` 与他人管理的资源重名；改 `kubernetes.ingress.serviceName`。
- **多路径分流（如 `/api` 与 `/`）** → 当前自动生成为「单 host → 单 Service」。需要多 path/多后端时，请自带 Ingress 清单，不要开启本功能。

## 不在范围内

- PR 预览在 K8s 上走 Traefik（预览目前仅 SSH/nginx）。
- `canary` / `blue_green`（K8s 执行器本就不支持）。
