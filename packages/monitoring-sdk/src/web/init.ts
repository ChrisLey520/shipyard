import type { App } from 'vue';
import type { AxiosInstance } from 'axios';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { createMonitoringClient, type MonitoringClient } from '../core/client.js';
import { sanitizeUrl } from '../core/sanitize.js';
import type { MonitoringPlugin } from '../core/types.js';
import { createFetchTransport } from './transport.js';
import { getOrCreateWebSessionId } from './session.js';

/** 与 vue-router 兼容的最小形状，避免 SDK 强依赖 vue-router */
export interface WebRouterLike {
  currentRoute: { value: { path?: string; name?: string | symbol; query?: Record<string, unknown> } };
  afterEach: (guard: () => void) => void;
}

export interface WebMonitoringOptions {
  projectKey: string;
  /** 完整 URL，如 https://host/v1/ingest/batch */
  endpoint: string;
  ingestToken: string;
  app: App;
  router?: WebRouterLike;
  axios?: AxiosInstance;
  sampleRate?: number;
  release?: string;
  env?: string;
  /** 为 false 时不采集（仅保留空实现） */
  enabled?: boolean;
  captureVueErrors?: boolean;
  captureWebVitals?: boolean;
  captureGlobalErrors?: boolean;
  /** 自定义采集插件（在内置 router/错误/web-vitals 等之前完成 setup） */
  plugins?: MonitoringPlugin[];
  /** 开启 IndexedDB 持久化队列（flush 失败回灌）；传 true 使用默认上限 */
  persistQueue?: boolean | { maxItems?: number; dbName?: string };
}

function deviceSummary(): Record<string, unknown> {
  if (typeof navigator === 'undefined') return {};
  return {
    language: navigator.language,
    userAgent: navigator.userAgent?.slice(0, 256),
    platform: navigator.platform,
  };
}

function noopClient(): MonitoringClient {
  const stub = {
    addBreadcrumb: () => {},
    capture: () => {},
    flush: async () => {},
    shutdown: async () => {},
    getQueueLength: () => 0,
  };
  return stub as unknown as MonitoringClient;
}

function reportVital(client: MonitoringClient, metric: Metric): void {
  client.capture(
    'web_vital',
    {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
    },
    { sample: true },
  );
}

/**
 * 浏览器端初始化监控；返回 client 供业务 addBreadcrumb / capture。
 */
export function initWebMonitoring(options: WebMonitoringOptions): MonitoringClient {
  if (options.enabled === false) {
    return noopClient();
  }

  const transport = createFetchTransport(options.endpoint, options.ingestToken);
  let currentRoute: string | undefined;

  const coreConfig = {
    projectKey: options.projectKey,
    endpoint: options.endpoint,
    ingestToken: options.ingestToken,
    platform: 'web',
    sampleRate: options.sampleRate ?? 1,
    getSessionId: getOrCreateWebSessionId,
    getRoute: () => currentRoute,
    getDevice: deviceSummary,
    transport,
    ...(options.release !== undefined ? { release: options.release } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.plugins !== undefined && options.plugins.length > 0 ? { plugins: options.plugins } : {}),
    ...(options.persistQueue === true
      ? { persistQueue: {} }
      : options.persistQueue && typeof options.persistQueue === 'object'
        ? { persistQueue: options.persistQueue }
        : {}),
  };
  const client = createMonitoringClient(coreConfig);

  if (options.router) {
    const syncRoute = () => {
      try {
        const r = options.router!.currentRoute.value;
        const path = r.path ?? r.name?.toString() ?? '';
        const q = r.query && Object.keys(r.query).length ? '?' + new URLSearchParams(r.query as Record<string, string>).toString().slice(0, 200) : '';
        currentRoute = sanitizeUrl(path + q);
      } catch {
        currentRoute = undefined;
      }
    };
    syncRoute();
    options.router.afterEach(() => {
      syncRoute();
      client.addBreadcrumb({ category: 'navigation', message: `route:${currentRoute ?? ''}` });
    });
  }

  if (options.captureGlobalErrors !== false && typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => {
      const msg = ev.message || 'Error';
      const stack = ev.error instanceof Error ? ev.error.stack : undefined;
      client.capture(
        'error',
        {
          message: msg,
          stack,
          filename: ev.filename,
          lineno: ev.lineno,
          colno: ev.colno,
          source: 'window.error',
        },
        { force: true },
      );
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      client.capture('error', { message, stack, source: 'unhandledrejection' }, { force: true });
    });
  }

  if (options.captureVueErrors !== false) {
    const prev = options.app.config.errorHandler;
    options.app.config.errorHandler = (err, instance, info) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      client.capture(
        'error',
        {
          message,
          stack,
          info,
          source: 'vue',
          componentName:
            instance &&
            typeof instance === 'object' &&
            '$options' in instance &&
            typeof (instance as { $options?: { name?: string } }).$options?.name === 'string'
              ? (instance as { $options: { name?: string } }).$options.name
              : undefined,
        },
        { force: true },
      );
      if (typeof prev === 'function') {
        prev(err, instance, info);
      }
    };
  }

  if (options.captureWebVitals !== false && typeof window !== 'undefined') {
    try {
      onLCP((m) => reportVital(client, m));
      onINP((m) => reportVital(client, m));
      onCLS((m) => reportVital(client, m));
      onFCP((m) => reportVital(client, m));
      onTTFB((m) => reportVital(client, m));
    } catch {
      /* 忽略 web-vitals 异常 */
    }
  }

  if (options.axios) {
    const ax = options.axios;
    ax.interceptors.response.use(
      (res) => {
        const start = (res.config as { metadata?: { start?: number } }).metadata?.start;
        if (start !== undefined) {
          const duration = Date.now() - start;
          if (duration > 5000) {
            client.capture(
              'http_slow',
              {
                url: sanitizeUrl(res.config.url ?? ''),
                method: res.config.method,
                status: res.status,
                durationMs: duration,
              },
              { sample: true },
            );
          }
        }
        return res;
      },
      (err: unknown) => {
        const axErr = err as {
          config?: { url?: string; method?: string; metadata?: { start?: number } };
          response?: { status?: number; data?: unknown };
          message?: string;
        };
        const cfg = axErr.config;
        const start = cfg?.metadata?.start;
        const duration = start !== undefined ? Date.now() - start : undefined;
        client.capture(
          'http_error',
          {
            url: cfg?.url ? sanitizeUrl(cfg.url) : '',
            method: cfg?.method,
            status: axErr.response?.status,
            durationMs: duration,
            message: axErr.message,
          },
          { force: true },
        );
        return Promise.reject(err);
      },
    );
    ax.interceptors.request.use((config) => {
      (config as { metadata?: { start: number } }).metadata = { start: Date.now() };
      return config;
    });
  }

  const flushOnLeave = () => {
    void client.flush(true);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushOnLeave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushOnLeave();
    });
  }

  return client;
}
