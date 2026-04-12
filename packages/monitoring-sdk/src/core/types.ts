/** 与 monitoring-contracts 对齐 */
export type MonitoringEventType =
  | 'error'
  | 'resource_error'
  | 'http_error'
  | 'http_slow'
  | 'web_vital'
  | 'timing'
  | 'healthcheck'
  | 'custom';

export interface MonitoringBreadcrumb {
  t: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MonitoringEvent {
  eventId: string;
  type: MonitoringEventType;
  timestamp: string;
  platform: string;
  sdkVersion: string;
  sessionId: string;
  payload: Record<string, unknown>;
  release?: string;
  env?: string;
  userId?: string;
  route?: string;
  device?: Record<string, unknown>;
  network?: string;
  sampleRate?: number;
  breadcrumbs?: MonitoringBreadcrumb[];
}

export interface IngestBatchRequest {
  projectKey: string;
  events: MonitoringEvent[];
}

export type TransportSend = (input: {
  body: string;
  useBeacon?: boolean;
  contentType?: string;
}) => Promise<boolean>;

/** 插件 teardown，与 setup 注册顺序相反执行 */
export type MonitoringPluginCleanup = () => void;

/** 不暴露 ingestToken / transport，避免第三方插件滥用 */
export interface MonitoringPluginContext {
  capture: (
    type: MonitoringEventType,
    payload: Record<string, unknown>,
    options?: { sample?: boolean; force?: boolean },
  ) => void;
  addBreadcrumb: (entry: Omit<MonitoringBreadcrumb, 't'> & { t?: string }) => void;
  flush: (useBeacon?: boolean) => Promise<void>;
  platform: string;
  release?: string;
  env?: string;
}

export interface MonitoringPlugin {
  name: string;
  setup: (ctx: MonitoringPluginContext) => void | MonitoringPluginCleanup;
}

export interface MonitoringCoreConfig {
  projectKey: string;
  /** 完整 ingest URL，如 https://host/v1/ingest/batch */
  endpoint: string;
  ingestToken: string;
  platform: string;
  /** 0~1，默认 1 */
  sampleRate?: number;
  release?: string;
  env?: string;
  /** 会话 ID，由平台注入 */
  getSessionId: () => string;
  /** 当前路由，由平台注入 */
  getRoute?: () => string | undefined;
  getDevice?: () => Record<string, unknown> | undefined;
  getNetwork?: () => string | undefined;
  /** 脱敏：额外敏感字段名（小写匹配） */
  sensitiveKeys?: string[];
  maxBatchSize?: number;
  flushIntervalMs?: number;
  /** 面包屑条数上限 */
  maxBreadcrumbs?: number;
  /** 单条 breadcrumb data 序列化长度上限 */
  maxBreadcrumbDataChars?: number;
  transport: TransportSend;
  /** 覆盖默认 SDK 版本号 */
  sdkVersion?: string;
  /** 自定义采集插件，构造时依次 setup；shutdown 时逆序 teardown 再 flush */
  plugins?: MonitoringPlugin[];
  /**
   * 仅浏览器：IndexedDB 持久化内存队列（已脱敏后的 MonitoringEvent）。
   * flush 失败时回灌；条数上限默认 100。
   */
  persistQueue?: { maxItems?: number; dbName?: string };
}
