/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONITORING_API: string;
  readonly VITE_MONITORING_ADMIN_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
