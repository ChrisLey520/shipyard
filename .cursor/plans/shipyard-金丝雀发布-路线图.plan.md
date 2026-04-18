---
name: Shipyard 金丝雀发布路线图
overview: 分阶段交付 SSH Nginx 金丝雀：releaseConfig 扩展、split_clients 生成、写入失败恢复、Web 表单与文档；需求规格见同目录需求规格文档。
todos:
  - id: canary-req-done
    content: 需求规格 shipyard-金丝雀发布-需求规格.md 已定稿并互链
    status: completed
  - id: canary-p0-schema-deploy
    content: P0：schema + validate + canary-nginx-fragment + deploy 串联 + 原子写入备份恢复
    status: completed
  - id: canary-p1-web
    content: P1：EnvironmentModal 金丝雀字段与 JSON 合并
    status: completed
  - id: canary-docs
    content: README/EN + docs/runbooks/canary-nginx.md
    status: completed
isProject: false
---

# Shipyard 金丝雀发布路线图

| 项 | 内容 |
|----|------|
| 需求规格 | [shipyard-金丝雀发布-需求规格.md](./shipyard-金丝雀发布-需求规格.md) |
| 总体规划 | [shipyard-金丝雀发布-规划.plan.md](./shipyard-金丝雀发布-规划.plan.md)（若存在） |

## 阶段

1. **P0**：`releaseConfig.ssh` 新字段、保存校验（含 K8s+canary 拒绝）、`generateCanarySplitClientsFragment`、部署时解析有效 body、`sshWriteCanaryNginxAtomic` 备份/恢复。
2. **P1**：Web 环境模态框策略选择与金丝雀字段，合并进 `releaseConfig`。
3. **文档**：README 表、英文版、运维 runbook。

## 代码锚点

- `apps/server/src/modules/environments/domain/release-config.schema.ts`
- `apps/server/src/modules/environments/application/release-config.validation.ts`
- `apps/server/src/modules/deploy/domain/canary-nginx-fragment.ts`
- `apps/server/src/modules/deploy/application/deploy.application.service.ts`
- `apps/web/src/pages/projects/components/EnvironmentModal.vue`
