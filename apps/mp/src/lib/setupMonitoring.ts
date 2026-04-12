import type { App } from 'vue';
import { initUniMonitoring } from '@shipyard/monitoring-sdk/uni';

/** 小程序端监控；开发默认关闭，生产默认开启（可用 VITE_MONITORING_DISABLED 关闭） */
export function setupMonitoring(app: App): void {
  const endpoint = import.meta.env.VITE_MONITORING_ENDPOINT as string | undefined;
  const projectKey = import.meta.env.VITE_MONITORING_PROJECT_KEY as string | undefined;
  const token = import.meta.env.VITE_MONITORING_INGEST_TOKEN as string | undefined;

  const prodOn =
    import.meta.env.PROD && String(import.meta.env.VITE_MONITORING_DISABLED || '').toLowerCase() !== 'true';
  const devOn = String(import.meta.env.VITE_MONITORING_ENABLED || '').toLowerCase() === 'true';
  const enabled = (prodOn || devOn) && Boolean(endpoint && projectKey && token);

  const opts = {
    enabled,
    app,
    endpoint: endpoint ?? '',
    projectKey: projectKey ?? '',
    ingestToken: token ?? '',
    env: import.meta.env.MODE,
    ...(import.meta.env.VITE_MONITORING_RELEASE
      ? { release: String(import.meta.env.VITE_MONITORING_RELEASE) }
      : {}),
    ...(import.meta.env.UNI_PLATFORM ? { platform: String(import.meta.env.UNI_PLATFORM) } : {}),
  };
  initUniMonitoring(opts);
}
