import type { Logger } from '@nestjs/common';
import { shouldRunBuildInDocker } from './docker-build.executor';

export const SHIPYARD_BUILD_USE_DOCKER = process.env['SHIPYARD_BUILD_USE_DOCKER'] === 'true';

export function logDockerBuildModeOnStartup(logger: Logger): void {
  if (!SHIPYARD_BUILD_USE_DOCKER) return;
  if (shouldRunBuildInDocker()) {
    logger.log(
      '已启用 SHIPYARD_BUILD_USE_DOCKER=true：install/lint/test/build 将在 Linux 上通过 Docker 容器执行（git clone 仍在宿主）。',
    );
  } else {
    logger.warn(
      `[docker-build] SHIPYARD_BUILD_USE_DOCKER=true 仅在 Linux 上生效；当前为 ${process.platform}，构建将仍使用本机 child_process 直至换用 Linux Worker。`,
    );
  }
}
