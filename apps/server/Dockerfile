# monorepo 根目录为构建上下文；与仓库根 Dockerfile 内容须保持一致（流水线 docker build . 使用根 Dockerfile）。
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

# 默认启动 API Server，Worker 通过 command 覆盖
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node dist/main.js"]

EXPOSE 3000
