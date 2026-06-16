# Shipyard Node.js 后端部署需求规格

## 背景

当前 Shipyard 的 SSH 部署主路径更偏向静态站点 / SSR 站点：

- 构建产物默认仅归档 `outputDir`
- 远端 PM2 / Nginx 逻辑按 SSR 站点语义硬编码
- 常规环境 PM2 进程名未区分环境，多个环境共机时易冲突

这会导致 NestJS / Express / Koa 等 Node.js 后端服务即使构建成功，部署后也可能因为缺少运行时依赖、入口配置不完整或进程名冲突而启动失败。

## 目标

为 Shipyard 增加可用的 Node.js 后端部署语义，使「构建成功」到「远端 PM2 成功拉起服务」之间链路闭环。

## P0

### FR-NODE-001 项目类型

- 项目 `frameworkType` 新增 `nodejs`
- Web / MP 项目配置页可选择 Node.js 后端

### FR-NODE-002 运行时归档

- 当 `frameworkType=nodejs` 时，构建阶段不能只归档 `outputDir`
- 应生成可部署的 Node.js 运行时 bundle，至少包含：
  - 构建后的应用目录
  - 运行所需 `package.json`
  - 生产依赖
- 对 pnpm workspace 项目优先使用可复现的 workspace 打包方式
- 对当前不支持的 workspace / 包管理器组合，需给出明确错误提示，而不是部署后才失败

### FR-NODE-003 远端启动

- `frameworkType=nodejs` 走 PM2 启动路径
- 项目配置页可配置 Node 入口文件与服务端口
- 若环境配置了域名，则自动生成 Nginx 反代到该服务端口
- 若未配置域名，也应允许纯 PM2 方式部署成功

### FR-NODE-004 多环境隔离

- 常规环境 PM2 进程名需包含项目与环境维度
- 同一项目在同机不同环境部署时不得互相覆盖

## 非目标

- 本期不扩展 Node.js 后端的 PR Preview 语义
- 本期不改 Kubernetes 部署主路径
- 本期不覆盖所有 workspace / 包管理器矩阵，只要求失败时可解释

## 验收

- `frameworkType=nodejs` 项目可保存并触发部署
- 构建阶段能产出 Node.js 可运行 bundle，而非仅 `dist` tarball
- SSH 部署后能用 PM2 启动 / 重载 Node.js 服务
- 配置域名时，Nginx 反代端口与项目配置一致，不再固定写死 `3000`
- 同机 `staging` / `production` 两个环境部署同一项目时，PM2 进程名不冲突
