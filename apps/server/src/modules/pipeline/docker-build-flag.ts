import type { Logger } from '@nestjs/common';

/** 预留：在 rootless 容器内执行构建（v0.3.1+）；当前未改变执行路径 */
export const SHIPYARD_BUILD_USE_DOCKER = process.env['SHIPYARD_BUILD_USE_DOCKER'] === 'true';

export function warnIfDockerBuildFlagWithoutExecutor(logger: Logger): void {
  if (SHIPYARD_BUILD_USE_DOCKER) {
    logger.warn(
      '已设置 SHIPYARD_BUILD_USE_DOCKER=true：rootless 容器内构建尚在路线图中，当前仍使用本机 child_process；详见 README「Docker 构建隔离」。',
    );
  }
}
