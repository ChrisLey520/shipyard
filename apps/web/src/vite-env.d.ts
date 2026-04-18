/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONITORING_ENABLED?: string;
  readonly VITE_MONITORING_DISABLED?: string;
  readonly VITE_MONITORING_ENDPOINT?: string;
  readonly VITE_MONITORING_PROJECT_KEY?: string;
  readonly VITE_MONITORING_INGEST_TOKEN?: string;
  readonly VITE_MONITORING_RELEASE?: string;
  readonly VITE_APP_VERSION?: string;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
