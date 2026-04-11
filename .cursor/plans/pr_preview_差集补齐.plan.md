# PR Preview 差集补齐计划

前置：`develop` 已含 M1 提交 `feat(preview): 实现 GitHub PR 预览部署 M1`（GitHub `pull_request`、构建/部署/评论、Hook PATCH、管理端与 README）。

## 差集对照

| 项 | 现状 | 目标 |
|----|------|------|
| 评论 API 重试 | 仅日志 | 有限次重试（如 3 次、指数退避）；不因评论失败回滚部署 |
| 评论 PATCH 404 | 仍保留旧 `commentId` | 404 时清空 DB `commentId` 并 POST 新评论写回 id |
| 构建失败查 Preview | `findFirst({ deploymentId })` | 改为 `findUnique`（`deploymentId` 唯一） |
| dedup 返回 `previewId` | 极端竞态可能为空 | 去重分支始终 `findUnique(projectId_prNumber)` 取 id |
| PR `closed` + 运行中 deploy | 仅异步 teardown | 可选：对 `deploy-${deploymentId}` remove/cancel BullMQ job，再 SSH 清理（幂等） |
| GitLab/Gitee/Gitea MR | 仅 GitHub | Hook 注册/PATCH 补 MR 事件 + 解析 + 同一套 enqueue/teardown + 各平台评论 API |
| SSR 蓝绿 | 同端口 pm2 reload | 新端口起第二实例 → Nginx 切流 → 删旧 PM2 → 释放旧端口 |

## 阶段 A — 小改动优先

1. `git-pr-comment.application.service.ts`：内部 `fetchWithRetry`；PATCH/POST 对 429/5xx 重试；PATCH 404 → 清空 `commentId` 后 POST。
2. `deploy.application.service.ts` / `build-worker.service.ts`：处理「评论已删」并回写 `commentId`。
3. `pipeline.application.service.ts`：`deduped` 分支固定 `previewId`。
4. `build-worker.service.ts`：`findFirst` → `findUnique({ deploymentId })`。

## 阶段 B — closed 与队列

- Webhook `closed`：若有 `deploymentId`，对部署队列 `getJob('deploy-' + deploymentId)` 后 `remove`/`discard`（按 BullMQ 版本 API），再 `teardownPreviewForPr`。

## 阶段 C — 多平台 MR

- `http-remote-webhook.registrar.ts`：GitLab `merge_requests_events`；Gitee/Gitea 按文档补 PR 事件。
- 适配器解析统一到中性 `ParsedPullRequestPayload`；`WebhooksApplicationService` 分发到现有 `handlePullRequest`。
- 评论：按 provider 扩展 API（GitLab notes 等）。

## 阶段 D — SSR 蓝绿

- `deployPreview` SSR 分支：申请新端口、第二 PM2 名、Nginx 指向新端口、reload 成功后删旧进程并 `release` 旧端口；失败回滚策略在实现时选定并文档化。

## 建议顺序

`A → B → C → D`。

## 待办清单

- [ ] A：评论重试 + PATCH404 回退 POST；dedup `previewId`；`findUnique`
- [ ] B：closed 时取消 deploy job + teardown
- [ ] C：GitLab/Gitee/Gitea MR Webhook + 评论
- [ ] D：SSR 双端口蓝绿
