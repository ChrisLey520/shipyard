FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json tsconfig.browser.json tsconfig.json ./
RUN pnpm --filter @shipyard/shared build
RUN pnpm --filter @shipyard/web build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# 使用 nginx 官方镜像的 envsubst 机制（/etc/nginx/templates/*.template）
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
