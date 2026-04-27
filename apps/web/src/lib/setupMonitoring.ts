import type { App } from 'vue';
import router from '../router';
import { http } from '../api/client';

/**
 * 独立监控 Ingest；通过 VITE_MONITORING_* 配置。
 * 生产环境默认开启（可用 VITE_MONITORING_DISABLED=true 关闭）；开发环境需 VITE_MONITORING_ENABLED=true。
 */
export function setupMonitoring(app: App): void {
  void app;
  void router;
  void http;
  // 监控 SDK（@prism/sdk）已从仓库移除；如未来恢复，再在此处接入。
}
