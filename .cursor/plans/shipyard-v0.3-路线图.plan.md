---
name: Shipyard 下一主版本 0.3
overview: v0.3.0 平台能力深化（PR 预览蓝绿、飞书/Slack 加签、构建缓存与 Docker 隔离、部署预检、文档矩阵）；详细需求见同目录 shipyard-v0.3-需求规格.md
todos:
  - id: v03-preview-blue-green
    content: PR 预览 SSR 蓝绿：双进程、健康检查、Nginx 原子切换
    status: completed
  - id: v03-im-feishu-slack-sign
    content: 飞书/Slack 通知 channel 加签与单测
    status: completed
  - id: v03-build-cache-workdir
    content: BuildWorker lockfile 缓存与 workdir 边界强化
    status: completed
  - id: v03-deploy-precheck
    content: Deploy 远端 nginx/rsync/pm2/nvm 等预检与结构化失败提示
    status: completed
  - id: v03-docker-build-phase2
    content: Docker rootless 构建隔离（或 v0.3.1 占位+文档）
    status: completed
  - id: v03-readme-changelog
    content: v0.3.0 CHANGELOG + README 路线图同步 + 可选 E2E
    status: completed
isProject: false
---

# Shipyard v0.3.0 路线图（简版）

**详细需求（FR/NFR、验收表、风险）** → [.cursor/plans/shipyard-v0.3-需求规格.md](./shipyard-v0.3-需求规格.md)

## 版本定位

- **基线**：v0.2.0（CHANGELOG）
- **主题**：预览蓝绿、通知补全、构建缓存/隔离、部署预检、文档与 CI

## 必达能力摘要

1. **PR 预览 SSR**：新旧并行、健康检查门禁、Nginx 原子切换、失败回滚  
2. **飞书 / Slack**：`secret` 加签；SSRF 守卫不变  
3. **Build**：lockfile 指纹缓存、workdir 并发安全  
4. **Deploy**：远端命令预检、`[precheck]` 结构化日志  
5. **Docker 构建**：可 flag；可拆 v0.3.1  

## 不包含

多区域 HA、审计、1.0 商业就绪打包。

## 建议里程碑

- **alpha**：通知加签 + 预检 + 构建缓存 MVP  
- **beta**：预览蓝绿主路径 + README  
- **rc**：Docker 或占位 + 回归  
