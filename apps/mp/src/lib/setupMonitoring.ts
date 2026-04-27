import type { App } from 'vue';
import { initUniMonitoring } from '@prism/sdk/uni';
import { readUniPlatformLabel } from '@/utils/uniPlatform';

/** 小程序端监控；开发默认关闭，生产默认开启（可用 VITE_MONITORING_DISABLED 关闭） */
export function setupMonitoring(app: App): void {
  const endpoint = import.meta.env.VITE_MONITORING_ENDPOINT as string | undefined;
  const projectKey = import.meta.env.VITE_MONITORING_PROJECT_KEY as string | undefined;
  const token = import.meta.env.VITE_MONITORING_INGEST_TOKEN as string | undefined;

  const prodOn =
    import.meta.env.PROD && String(import.meta.env.VITE_MONITORING_DISABLED || '').toLowerCase() !== 'true';
  const devOn = String(import.meta.env.VITE_MONITORING_ENABLED || '').toLowerCase() === 'true';
  const enabled = (prodOn || devOn) && Boolean(endpoint && projectKey && token);
  // 未开启时完全不初始化 SDK，避免对 uni.request / 定时器等产生任何介入（便于排查工具链误报）
  if (!enabled) {
    return;
  }

  const opts = {
    enabled: true,
    app,
    endpoint: endpoint ?? '',
    projectKey: projectKey ?? '',
    ingestToken: token ?? '',
    env: import.meta.env.MODE,
    ...(import.meta.env.VITE_MONITORING_RELEASE
      ? { release: String(import.meta.env.VITE_MONITORING_RELEASE) }
      : {}),
    platform: readUniPlatformLabel(),
  };
  initUniMonitoring(opts);
}
