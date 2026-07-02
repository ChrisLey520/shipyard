-- 容器镜像构建使用的 Dockerfile 相对路径（相对仓库根，如 apps/web/Dockerfile）；留空用根 Dockerfile
ALTER TABLE "PipelineConfig" ADD COLUMN "containerDockerfilePath" TEXT;
