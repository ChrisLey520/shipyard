FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
# 只构建管理后台：避免 workspace 中其它应用（如 mp）残留的本地 file: 依赖影响安装
COPY package.json pnpm-lock.yaml ./
RUN printf '%s\n' "packages:" "  - \"apps/web\"" "  - \"packages/shared\"" > pnpm-workspace.yaml
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
