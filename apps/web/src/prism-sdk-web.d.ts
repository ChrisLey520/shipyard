declare module '@prism/sdk/web' {
  import type { App } from 'vue';
  const initWebMonitoring: (args: {
    enabled: boolean;
    app: App;
    router: unknown;
    axios: unknown;
    endpoint: string;
    projectKey: string;
    ingestToken: string;
    release: string | undefined;
    env: string;
  }) => void;
  export { initWebMonitoring };
}

