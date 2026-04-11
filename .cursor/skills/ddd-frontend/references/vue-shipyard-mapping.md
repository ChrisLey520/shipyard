# Vue 前端与 Shipyard 仓库映射（DDD）

**UI/视觉**：实现或改页面时必须先遵循项目 Skill **`shipyard-ui-spec`**（与本 reference 正交：此处只描述 DDD 分层与目录，不定义外观规范）。

## 目录速查

| 层级（概念） | 典型落地（`apps/web/src`） | 职责 |
|-------------|---------------------------|------|
| 界面 / 适配 | `pages/**`, `components/**` | 展示、交互、路由参数；不写业务规则与 HTTP |
| 应用 / 用例 | `composables/**` 或 `pages/<ctx>/use*.ts` | 编排用例、组合 Query/Mutation、调用 mapper |
| 远程端口 | `api/**`, `api/client.ts` | HTTP、错误归一、DTO 进出 |
| 防腐层 | `api/**/mappers.ts` 或 `*Mapper` | DTO ↔ UI 模型 |
| 共享内核 | `@shipyard/shared` | 枚举、纯函数、无 IO |

## 何时拆 `api/<context>/`

- 同一上下文下 **3 个以上** 端点或 DTO 映射开始重复。
- 需要独立演进（版本、错误码、分页约定）时。

## Query 与 Store 分工

- **TanStack Query**：列表/详情/变更后的服务器真相；key 建议包含 `orgSlug`、`projectSlug` 等作用域。
- **Pinia**：登录会话、主题、语言、向导草稿等 **非服务器真相** 或必须跨路由保留的客户端状态。

## 集成上下文（最小化）

跨上下文页面只通过：

- 路由参数与只读 Query 拉取对方资源，或
- 极薄的 `composables/integration/*`，内部仍调用各自 `api` 模块

禁止在 A 上下文 `api` 中直接依赖 B 上下文 Vue 组件。
