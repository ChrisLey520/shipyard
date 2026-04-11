-- PR 预览 SSR 健康检查路径（默认可空，代码侧回退为 /）
ALTER TABLE "PipelineConfig" ADD COLUMN "previewHealthCheckPath" TEXT;
