---
name: Shipyard 顺架构发布策略路线图
overview: 轴线 A/B/C 实现与文档；需求规格见同目录需求规格文档。
todos:
  - id: impl-a
    content: 轴线 A：nginxCanaryTemplate + upstream_weight 生成与 Web
    status: completed
  - id: impl-b
    content: 轴线 B：K8s blue_green 拒绝 + rollout 超时与 rolling patch
    status: completed
  - id: impl-c
    content: 轴线 C：object_storage + aws s3 sync
    status: completed
  - id: docs-changelog
    content: README/EN、runbook、CHANGELOG Unreleased
    status: completed
isProject: false
---

# 顺架构发布策略 — 路线图

| 项 | 链接 |
|----|------|
| 需求规格 | [shipyard-顺架构发布策略-需求规格.md](./shipyard-顺架构发布策略-需求规格.md) |
| 总规划 | [shipyard-顺架构发布策略扩展.plan.md](./shipyard-顺架构发布策略扩展.plan.md) |

## 实现锚点

- [release-config.schema.ts](../../apps/server/src/modules/environments/domain/release-config.schema.ts)
- [deploy.application.service.ts](../../apps/server/src/modules/deploy/application/deploy.application.service.ts)
- [canary-nginx-fragment.ts](../../apps/server/src/modules/deploy/domain/canary-nginx-fragment.ts)
- [EnvironmentModal.vue](../../apps/web/src/pages/projects/components/EnvironmentModal.vue)
