# Shipyard 限界上下文与依赖（DDD 重构参考）

本文档描述各业务上下文的聚合候选、后端模块、前端页面及**推荐接口检查顺序**。不含任何密钥或凭据。

## 检查顺序模板（HTTP）

1. `POST /api/auth/login` → `accessToken`
2. `GET /api/orgs` → `orgSlug`
3. 按领域调用写接口 → `GET` 校验 → **按相反顺序删除测试数据**
4. **跳过自动化**：`POST .../deploy`、`POST .../deployments/:id/retry`、`POST .../deployments/:id/rollback` 及 Deploy 模块其它写操作

## 上下文一览

| 上下文 | 聚合根（候选） | Nest 模块 | 主要前端页面 |
|--------|----------------|-----------|--------------|
| auth | User（认证凭证侧） | `modules/auth` | Login, Register, Forgot/Reset password |
| users | User（资料与偏好） | `modules/users` | PersonalSettings（locale/头像） |
| orgs | Organization, Membership | `modules/orgs` | Orgs 列表、OrgSettings、Team |
| projects | Project | `modules/projects` | ProjectList/New/Detail |
| environments | Environment | `modules/environments` | EnvironmentsPage |
| servers | Server | `modules/servers` | ServersPage |
| git | GitAccount, GitConnection | `modules/git` | GitAccountsPage |
| approvals | ApprovalRequest | `modules/approvals` | ApprovalsPage |
| pipeline | Build, Deployment（运行侧） | `modules/pipeline` | DeploymentDetail（只读自动化） |
| deploy | Deployment（发布/回滚写路径） | `modules/deploy` | 用户自测，自动化不测写接口 |
| webhooks | Webhook 投递 | `modules/webhooks` | 无专属页 |
| notifications | 通知作业 | `modules/notifications`（Worker） | 无 |

## 模块间依赖（方向）

- `projects` 依赖 `orgs`（组织内项目）、常依赖 `git`（仓库连接）、`crypto`（密钥）
- `environments`、`pipeline`、`deploy` 依赖 `projects`
- `approvals` 与 `deploy` / `pipeline` 通过 Deployment 关联
- `git` 可被 `projects`、`webhooks` 间接使用
- `auth` / `users` 为横切身份；业务模块依赖 `AuthModule` 导出的 JWT 能力而非穿透 `auth` 内部实现

## 与 packages/shared

- 仅放置无 IO 的枚举、DTO 形状、纯函数；不把 Prisma 生成类型放入领域 exports。

## 测试策略（阶段 3）

- **domain**：纯函数与不变量用 Jest/Vitest 单测，无 Nest 容器。
- **application**：对端口 mock 后测用例编排；Nest `TestingModule` 仅用于集成切片。
- **基础设施**：Prisma 仓储可选 test DB 或 `prisma migrate` 后的本地 Postgres。
- **HTTP 冒烟**：仓库根目录 `scripts/api-smoke.sh`（需环境变量 `SERVER_URL`、`E2E_EMAIL`、`E2E_PASSWORD`，可从 `.local/agent-test.env` source）验证登录与 `/orgs`；**不包含**部署类写接口。

## 修订记录

- 初版：与仓库 DDD 技能及执行计划对齐。
- 补充测试策略与 api-smoke 脚本说明。
