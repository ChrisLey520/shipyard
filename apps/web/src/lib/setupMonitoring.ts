import type { App } from 'vue';
import { initWebMonitoring } from '@prism/sdk/web';
import router from '../router';
import { http } from '../api/client';

/**
 * 独立监控 Ingest；通过 VITE_MONITORING_* 配置。
 * 生产环境默认开启（可用 VITE_MONITORING_DISABLED=true 关闭）；开发环境需 VITE_MONITORING_ENABLED=true。
 */
export function setupMonitoring(app: App): void {
  const endpoint = import.meta.env.VITE_MONITORING_ENDPOINT as string | undefined;
  const projectKey = import.meta.env.VITE_MONITORING_PROJECT_KEY as string | undefined;
  const token = import.meta.env.VITE_MONITORING_INGEST_TOKEN as string | undefined;

  const prodOn =
    import.meta.env.PROD && String(import.meta.env.VITE_MONITORING_DISABLED || '').toLowerCase() !== 'true';
  const devOn = String(import.meta.env.VITE_MONITORING_ENABLED || '').toLowerCase() === 'true';
  const enabled = (prodOn || devOn) && Boolean(endpoint && projectKey && token);

  initWebMonitoring({
    enabled,
    app,
    router,
    axios: http,
    endpoint: endpoint ?? '',
    projectKey: projectKey ?? '',
    ingestToken: token ?? '',
    release: (import.meta.env.VITE_MONITORING_RELEASE as string | undefined) ?? import.meta.env.VITE_APP_VERSION,
    env: import.meta.env.MODE,
  });
}
