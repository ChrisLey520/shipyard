-- 服务器操作系统（部署路径等依赖目标系统约定）
ALTER TABLE "Server" ADD COLUMN IF NOT EXISTS "os" TEXT NOT NULL DEFAULT 'linux';
