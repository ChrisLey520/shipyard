# Shipyard API/Worker 共用镜像。
# 与 apps/server/Dockerfile 同源：流水线在仓库根目录执行 docker build . 时请与此文件同步修改。
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 安装依赖（须含 lockfile，否则 pnpm install --frozen-lockfile 会直接失败）
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter "@shipyard/server..."

# 构建
FROM deps AS builder
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY tsconfig.base.json ./
RUN pnpm --filter @shipyard/shared build
RUN pnpm --filter @shipyard/server build

# 运行时
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

WORKDIR /app/apps/server

# 默认启动 API Server；Worker Deployment 请在清单中覆盖 command。
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node dist/main.js"]

EXPOSE 3000
