# NestJS 后端与 Shipyard 仓库映射（DDD）

## 与现有结构的关系

- **顶层模块**：`apps/server/src/app.module.ts` 中 `imports` 的每个 `*Module` 通常对应一个限界上下文或清晰子域（如 `projects`、`pipeline`、`git`）。
- **共享技术能力**：`common/prisma`、`common/redis`、`common/crypto` 等是 **基础设施构件**，不是业务上下文；业务模块依赖它们提供的技术端口。

## 模块内推荐目录（渐进采用）

```
modules/<context>/
├── <context>.module.ts
├── <context>.controller.ts
├── application/
│   └── *.service.ts          # 用例编排（可逐步从根目录 *Service 迁入）
├── domain/
│   └── *.ts                  # 实体、值对象、领域服务、领域事件类型
├── infrastructure/
│   └── *.repository.ts       # Prisma 实现、外部 API 适配器
└── dto/                      # HTTP 入参/出参（若已有可保留）
```

不必一次性搬完；新文件优先按分层落位，旧文件触及时再迁移。

## Prisma 与领域

- **Schema**：全局数据模型，允许多上下文共享表；**领域边界**由模块内类型与仓储查询范围体现，而非每张表一个模块。
- **事务**：在 application 层声明用例级事务边界（例如 `prisma.$transaction` 位于 infrastructure 或薄 application 协调器中），领域层保持无 IO。

## Worker

- `apps/server/src/worker.module.ts` 中的处理器应复用与 HTTP 相同的 application 用例，避免在 processor 内堆叠业务分支。

## 测试建议

- domain：纯单元测试（无 Nest TestingModule）。
- application：mock 端口接口。
- infrastructure：可选集成测试（真实 DB 或 testcontainer 视项目策略而定）。
