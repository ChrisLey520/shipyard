---
name: ddd-frontend
description: Shipyard 管理后台（Vue 3 + Vite + Pinia + TanStack Vue Query + Naive UI）按 DDD 思想组织前端：限界上下文（bounded context）、用例/应用层编排、UI 视图模型与后端 DTO 隔离、API 防腐层（ACL）、跨上下文集成方式。凡涉及页面 UI/样式/组件/视觉规范，须与项目 Skill `shipyard-ui-spec` 联用（先遵循其模板、令牌与清单）。适用于新增或重构 `apps/web` 页面与目录、拆分/合并 Pinia store 与 `api` 模块、减少页面直接依赖 HTTP 形状、设计路由与功能边界、评审前端模块耦合与可测试性时使用。
---

# DDD 前端架构（Shipyard / Project Skill）

本 Skill 约束 **Shipyard `apps/web`** 的前端架构决策，使界面层、应用编排、远程数据访问边界清晰，便于演进与测试。

## 与 `shipyard-ui-spec` 的关系（强制）

- **任何**新增/改造页面、布局、表格、表单、弹窗、空状态、加载与错误态、主题与 UnoCSS 用法：必须先按 **`shipyard-ui-spec`**（`PAGE-TEMPLATES.md`、`FOUNDATIONS.md`、`COMPONENTS.md`、`CHECKLIST.md`、`NAIVE-UI-THEME.md`）执行；本 Skill **不**替代该规范。
- **分工**：`shipyard-ui-spec` 管「长什么样、用什么组件与 tokens」；`ddd-frontend` 管「代码分几层、边界与数据流」。

## 执行流程（新增或改动功能时）

1. **命名限界上下文**：用业务语言框定能力范围（例如：项目交付、流水线运行、组织与成员、Git 连接）。一个上下文对应一组页面 + 一组 `api` +（可选）专用 store/composables。
2. **画依赖方向**：只允许 **页面/组件 → 应用层（composables 或用例函数）→ API 适配器 → HTTP**；禁止页面直接拼装 URL 或散落 `fetch`。
3. **定义 UI 模型**：在边界处把 DTO 映射为视图模型（只含界面需要字段、枚举、状态文案），**禁止**把 Prisma/API 原始类型泄漏到模板与业务判断里。
4. **选状态策略**：服务器状态优先 **TanStack Query**（缓存、失效、重试）；会话级/纯客户端状态用 **Pinia**；不要把“可推导的服务器数据”长期复制进全局 store。
5. **对齐 UI 规范（硬前置）**：在落代码前确认已按 **`shipyard-ui-spec`** 选定页面模板与设计令牌；共享纯类型与枚举优先 `@shipyard/shared`。

## 硬性规则（必须遵守）

- **单一入口调用远程**：同上下文的 HTTP 调用集中在 `src/api/<context>/`（或同目录 `api.ts` 模式），页面不直接依赖 `client` 细节。
- **防腐层**：DTO → UI model 的映射函数放在 API 模块或紧邻的 `mappers.ts`；跨上下文复用 DTO 形状前要先确认是否属于同一泛化语言（Ubiquitous Language）。
- **无循环依赖**：`pages` 不互相 import 业务逻辑；共享 UI 只放 `components/`；跨上下文仅通过显式“集成层”composable（薄适配）协作。
- **边界测试友好**：应用层 composable 可单测时应对 **已映射的 UI 模型** 或 mock 的 repository 接口，而不是裸 axios 响应。

## 与仓库目录的对应关系

详见 [`references/vue-shipyard-mapping.md`](references/vue-shipyard-mapping.md)（何时新建 `api/` 子目录、何时引入 `queries/`、`mappers` 命名约定）。

## 产出要求（你让我做架构/重构时应交付什么）

- **上下文清单**：列出涉及的 bounded context、各自职责、对外暴露的用例（user flows）。
- **目录与依赖图**：说明新增/移动的文件、允许的 import 方向。
- **数据流**：Query key 约定、失效策略、Pinia 中仅存何种客户端状态。
- **风险与迁移步骤**：若需渐进式重构，给出最小可合并的步骤序列。
