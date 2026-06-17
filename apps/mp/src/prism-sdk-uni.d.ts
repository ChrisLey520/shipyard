declare module '@prism/sdk/uni' {
  import type { App } from 'vue';

  interface UniMonitoringOptions {
    enabled: boolean;
    app: App;
    endpoint: string;
    projectKey: string;
    ingestToken: string;
    env: string;
    release?: string;
    platform?: string;
  }

  const initUniMonitoring: (args: UniMonitoringOptions) => void;

  export { initUniMonitoring };
  export type { UniMonitoringOptions };
}
