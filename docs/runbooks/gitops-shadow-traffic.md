# Runbook 占位：GitOps 导出与影子流量

本文件为路线图中的 **Stretch** 占位，产品内不实现双向 reconcile 与影子流量控制器。

## GitOps（只读导出）

- 可选方向：从 Shipyard 导出项目/环境快照为静态 YAML，由外部 Flux/Argo CD 消费。
- 双向声明式 reconcile 不在当前版本范围。

## 影子流量

- 典型做法：在入口 Nginx 使用 `mirror` 将副本请求转发至灰度集群，或依赖 Service Mesh。
- Shipyard 不内建 mirror 编排；请在负载均衡或网关层按运维规范配置。

## 多区域 HA

- 维持规格 **Out of Scope**；需多活时请使用外部 DNS、全局负载均衡与数据层方案。
