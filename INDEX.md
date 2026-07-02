# 📚 Shipyard 框架与 Monorepo 文档索引

本目录包含关于 Shipyard 项目创建、框架类型和 Monorepo 工作目录的完整文档。

---

## 📖 文档清单

### 1. 🚀 快速参考 (推荐先读)
**文件**: [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md)  
**大小**: 6.4KB | **阅读时间**: 5-10 分钟

**包含内容**:
- 框架类型对比表（8 个特性维度）
- Monorepo 多应用示例结构
- API 端点格式（HTTP 请求/响应）
- 工作目录验证规则（允许和禁止的路径）
- 框架类型决策树
- Monorepo 工作流（两个常见场景）
- 常见错误与排查表

**何时使用**:
- 快速了解框架类型的差别
- 查阅 API 端点格式
- 排查常见错误

---

### 2. 📖 完整指南 (深入学习)
**文件**: [`FRAMEWORK_AND_MONOREPO_GUIDE.md`](./FRAMEWORK_AND_MONOREPO_GUIDE.md)  
**大小**: 19KB | **阅读时间**: 30-45 分钟

**包含内容**:
1. 框架类型枚举定义（3 种）
2. 数据模型定义（Project、PipelineConfig）
3. 创建项目的 API 和 DTO
4. 框架类型与构建行为对应关系
5. 创建项目的前端表单和逻辑
6. Monorepo 子应用与工作目录的实现
7. 框架类型与部署的对应关系总结
8. 相关文件查阅快速索引（18 个文件）
9. 关键提交说明
10. 常见 Q&A（6 个问答）

**何时使用**:
- 深入理解框架类型的实现原理
- 追踪源码时查阅文件路径和行号
- 理解工作目录的完整流程
- 解答架构设计相关问题

---

### 3. 📋 研究总结 (总体概览)
**文件**: [`RESEARCH_SUMMARY.md`](./RESEARCH_SUMMARY.md)  
**大小**: 12KB | **阅读时间**: 15-20 分钟

**包含内容**:
- 研究成果摘要（核心发现列表）
- 框架类型枚举详解
- 工作目录特性说明
- 批量建项功能说明
- 框架类型与部署关系
- 实际使用场景示例
- 源码追踪速查表（17 行文件）
- 关键技术点总结
- 验证和约束规则
- 质量检查清单

**何时使用**:
- 获得总体概览
- 追踪源码时快速查阅文件位置
- 了解关键提交和变更内容

---

## 🔍 按使用场景选择文档

### 📌 "我想快速了解框架类型有哪些"
→ 阅读 **QUICK_REFERENCE.md** 的 "框架类型对比" 部分（2 分钟）

### 📌 "我需要了解 API 端点的请求格式"
→ 阅读 **QUICK_REFERENCE.md** 的 "API 端点速查" 部分（3 分钟）

### 📌 "我要创建一个 Monorepo 项目，需要批量建项"
→ 阅读 **QUICK_REFERENCE.md** 的 "Monorepo 多应用示例" 和 **FRAMEWORK_AND_MONOREPO_GUIDE.md** 的 "第 5 章" （10 分钟）

### 📌 "我需要理解工作目录的验证规则"
→ 阅读 **QUICK_REFERENCE.md** 的 "工作目录验证规则" 或 **FRAMEWORK_AND_MONOREPO_GUIDE.md** 的 "第 6.1 章" （5 分钟）

### 📌 "我要追踪某个功能的源码"
→ 使用 **RESEARCH_SUMMARY.md** 的 "源码追踪速查表" 或 **FRAMEWORK_AND_MONOREPO_GUIDE.md** 的 "第 8 章" 快速定位文件路径和行号（1 分钟定位）

### 📌 "我要理解框架类型如何影响构建和部署"
→ 阅读 **FRAMEWORK_AND_MONOREPO_GUIDE.md** 的 "第 4 章" 和 "第 7 章" （15 分钟）

### 📌 "我遇到了构建或部署错误"
→ 阅读 **QUICK_REFERENCE.md** 的 "常见错误与排查表" （5 分钟）

---

## 🗂️ 核心源码文件位置速查

| 功能 | 文件 | 行号 |
|-----|------|-----|
| **框架枚举** | `packages/shared/src/enums.ts` | 25-29 |
| **DTO 定义** | `packages/shared/src/dto.ts` | 56-85 |
| **项目表** | `apps/server/prisma/schema.prisma` | 131-164 |
| **构建配置表** | `apps/server/prisma/schema.prisma` | 166-192 |
| **单项创建接口** | `apps/server/src/modules/projects/projects.controller.ts` | 26-46 |
| **批量创建接口** | `apps/server/src/modules/projects/projects.controller.ts` | 48-71 |
| **单项创建逻辑** | `apps/server/src/modules/projects/application/projects.application.service.ts` | 43-119 |
| **批量创建逻辑** | `apps/server/src/modules/projects/application/projects.application.service.ts` | 121-152 |
| **工作目录验证** | `apps/server/src/modules/pipeline/node-runtime-bundle.ts` | 8-14 |
| **构建工作流** | `apps/server/src/modules/pipeline/build-worker.service.ts` | 140-369 |
| **前端创建页面** | `apps/web/src/pages/projects/ProjectNewPage.vue` | 1-729 |
| **前端 API** | `apps/web/src/api/projects/index.ts` | 99-108 |

---

## 📊 框架类型速查

| 类型 | static | ssr | nodejs |
|-----|--------|-----|--------|
| **枚举值** | `'static'` | `'ssr'` | `'nodejs'` |
| **需要运行时** | ❌ | ✅ | ✅ |
| **默认启动脚本** | — | `dist/index.js` | `dist/main.js` |
| **示例框架** | Vue SPA、React SPA、Next.js export | Next.js、Nuxt | NestJS、Express、Fastify |

---

## 🔑 关键概念解释

### 框架类型 (FrameworkType)
定义项目的部署方式：
- **static**: 纯前端应用，构建产物为 HTML/CSS/JS，由 Web 服务器直接服务
- **ssr**: 服务端渲染应用，需要 Node.js 运行时，默认启动脚本 `dist/index.js`
- **nodejs**: Node.js 后端服务，需要运行时，默认启动脚本 `dist/main.js`

### 工作目录 (workingDirectory)
Monorepo 中每个子应用的相对路径：
- 存储在 `PipelineConfig.workingDirectory` 字段
- 构建时在该目录执行命令
- 支持 `apps/web`、`packages/backend` 等相对路径
- 禁止绝对路径和 `..` 上级目录

### 批量建项 (Bulk Create)
一次创建多个项目：
- 同一仓库下的多个应用可一次创建
- 支持为所有项目自动创建默认环境
- 支持预设模板快速配置（如"Web + Server"）

---

## ✅ 文档覆盖范围

本文档集覆盖：

- [x] 框架类型的枚举定义（3 种）
- [x] 工作目录的完整实现流程
- [x] 创建项目的 API（单个和批量）
- [x] 前端表单和组件
- [x] 后端 DTO 和验证规则
- [x] 数据库模型定义
- [x] 构建流程中的框架类型应用
- [x] 部署时的运行时判断
- [x] Monorepo 多应用支持
- [x] 实际使用场景示例

---

## 📌 相关提交

**主要提交**: `6900623901e62b128d17dd5aa31e64da0abb9654`
- **消息**: `feat(worker): 支持 monorepo 子应用工作目录与批量建项`
- **时间**: 2026-06-17 16:34:51 +0800
- **变更**: 21 文件，341 行新增
- **核心变更**:
  1. 添加 `PipelineConfig.workingDirectory` 字段
  2. 实现 `/projects/bulk` 端点
  3. 前端 UI 支持批量模式 + 预设模板 + 环境模板

---

## 💬 FAQ

**Q: 从哪个文档开始？**
A: 快速参考 (`QUICK_REFERENCE.md`) 入门，完整指南 (`FRAMEWORK_AND_MONOREPO_GUIDE.md`) 深入学习。

**Q: 如何快速定位源码？**
A: 使用 "源码追踪速查表"，有具体的文件路径和行号。

**Q: 工作目录和框架类型是什么关系？**
A: 无直接关系。工作目录指定在哪个子目录构建，框架类型指定构建后如何部署。

**Q: 一个项目能有多个工作目录吗？**
A: 不能。一个项目对应一个工作目录。多个子应用需要创建多个项目（使用批量建项）。

---

**最后更新**: 2026-07-02  
**生成工具**: Claude Code  
**文档版本**: 1.0
