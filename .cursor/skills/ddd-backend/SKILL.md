---
name: ddd-backend
description: Shipyard 后端（NestJS + Prisma + PostgreSQL + Redis/BullMQ）按 DDD 思想组织：限界上下文与 Nest 模块边界、领域层（实体/值对象/领域服务/不变量）、应用层（用例/应用服务/DTO 入参）、基础设施（Prisma、队列、外部 Git 平台适配）。适用于新增或重构 `apps/server/src/modules`、拆分臃肿 Service、界定事务与一致性边界、引入仓储接口与实现分离、讨论跨模块依赖、Worker 与 API 复用领域逻辑时使用。
---

# DDD 后端架构（Shipyard / Project Skill）

本 Skill 指导 **Shipyard `apps/server`** 如何在既有 NestJS 模块化结构上渐进落地 DDD，而不是一次性重写。

## 执行流程（新需求或重构时）

1. **对齐限界上下文**：优先与现有 `src/modules/<name>` 对齐；若出现新业务语言与现有模块混杂，考虑拆分子模块或提取新模块，而不是在单一 `*Service` 内无限增长。
2. **分层放置代码**（在单个模块内渐进引入）：
   - **domain/**：实体、值对象、领域服务、领域错误、工厂；**禁止**依赖 Nest 装饰器、Prisma、`HttpService`。
   - **application/**：用例类或应用服务，编排领域对象与端口；依赖 **接口（端口）** 而非具体 ORM。
   - **infrastructure/**：Prisma Repository、队列 Producer、Git 平台客户端适配；实现 domain/application 定义的端口。
   - **interface（Nest 原生层）**：`*.controller.ts`、DTO（class-validator）、Guard/Pipe；只做 HTTP 适配与鉴权。
3. **定义聚合边界**：一个事务内强一致修改的单位尽量对应一个聚合根；跨聚合用最终一致（事件、作业、显式编排）。
4. **Prisma 位置**：Prisma 属于基础设施；领域层不直接 `import { PrismaClient }`。小步迁移时允许暂时在 application service 中使用 Prisma，但应在 PR 中注明后续下沉计划。
5. **Worker 复用**：`worker.module` 中处理器应调用 **application 用例** 或领域服务，避免复制一份 SQL/业务规则。

## 硬性规则（必须遵守）

- **模块间依赖**：优先通过 **已导出的应用服务或端口接口**；禁止深层 `../../other-module` 穿透内部实现文件。
- **DTO 与领域模型分离**：Controller DTO ≠ 领域实体；在 application 层完成映射与校验策略（允许使用轻量 mapper）。
- **副作用边界**：发邮件、写 Commit Status、注册 Webhook 等属于集成逻辑，放在 infrastructure 或专用应用服务，领域层只表达“发生了什么”。

## 与仓库模块的对应关系

详见 [`references/nest-shipyard-mapping.md`](references/nest-shipyard-mapping.md)（与 `app.module.ts` 注册模块、与 `common/*` 共享组件的关系）。

## 产出要求（你让我做架构/重构时应交付什么）

- **上下文与聚合草图**：名词、聚合根、不变量、跨上下文协作方式（同步调用 vs 异步作业）。
- **拟议目录树**：`modules/<ctx>/` 下 domain/application/infrastructure 文件列表。
- **端口列表**：application 依赖的接口名、由谁实现（Prisma / Redis / HTTP）。
- **迁移策略**：若不能一次分层，列出阶段性提交与兼容措施。
