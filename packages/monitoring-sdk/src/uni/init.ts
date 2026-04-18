import type { App } from 'vue';
import { createMonitoringClient, type MonitoringClient } from '../core/client.js';
import type { MonitoringPlugin } from '../core/types.js';
import { sanitizeUrl } from '../core/sanitize.js';
import { createUniTransport } from './transport.js';
import { getOrCreateUniSessionId } from './session.js';
import { getCurrentUniRoute } from './route.js';
import { getUni } from './types.js';

export interface UniMonitoringOptions {
  projectKey: string;
  endpoint: string;
  ingestToken: string;
  app: App;
  /** 显式平台，如 mp-weixin、uni-h5 */
  platform?: string;
  sampleRate?: number;
  release?: string;
  env?: string;
  enabled?: boolean;
  captureVueErrors?: boolean;
  /** 包装全局 uni.request 以采集 http 失败 */
  wrapUniRequest?: boolean;
  plugins?: MonitoringPlugin[];
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

function detectPlatformLabel(fallback: string): string {
  const uni = getUni();
  try {
    const info = uni?.getSystemInfoSync?.();
    if (info?.uniPlatform) return `uni-${info.uniPlatform}`;
  } catch {
    /* ignore */
  }
  return fallback;
}

function deviceFromUni(): Record<string, unknown> | undefined {
  const uni = getUni();
  try {
    const info = uni?.getSystemInfoSync?.();
    if (!info) return undefined;
    return {
      model: info.model,
      system: info.system,
      uniPlatform: info.uniPlatform,
    };
  } catch {
    return undefined;
  }
}

/**
 * uni-app 端初始化（微信 / H5 等）；需在 createApp 之后调用。
 */
export function initUniMonitoring(options: UniMonitoringOptions): MonitoringClient {
  if (!options.enabled) {
    return noopClient();
  }

  const uniApi = getUni();
  const transport = createUniTransport(options.endpoint, options.ingestToken);
  const platform = options.platform ?? detectPlatformLabel('uni-unknown');

  const coreConfig = {
    projectKey: options.projectKey,
    endpoint: options.endpoint,
    ingestToken: options.ingestToken,
    platform,
    sampleRate: options.sampleRate ?? 1,
    getSessionId: getOrCreateUniSessionId,
    getRoute: () => getCurrentUniRoute(),
    getDevice: deviceFromUni,
    transport,
    ...(options.release !== undefined ? { release: options.release } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.plugins !== undefined && options.plugins.length > 0 ? { plugins: options.plugins } : {}),
  };
  const client = createMonitoringClient(coreConfig);

  if (uniApi?.onError) {
    uniApi.onError((msg: string) => {
      client.capture('error', { message: msg, source: 'uni.onError' }, { force: true });
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

  if (options.wrapUniRequest !== false && uniApi) {
    const raw = uniApi.request.bind(uniApi);
    uniApi.request = (opts) => {
      const start = Date.now();
      const url = typeof opts.url === 'string' ? opts.url : '';
      const origSuccess = opts.success;
      const origFail = opts.fail;
      opts.success = (res) => {
        if (res.statusCode >= 400) {
          client.capture(
            'http_error',
            {
              url: sanitizeUrl(url),
              status: res.statusCode,
              durationMs: Date.now() - start,
            },
            { force: true },
          );
        } else {
          const duration = Date.now() - start;
          if (duration > 5000) {
            client.capture(
              'http_slow',
              { url: sanitizeUrl(url), status: res.statusCode, durationMs: duration },
              { sample: true },
            );
          }
        }
        if (origSuccess) origSuccess(res);
      };
      opts.fail = (err) => {
        client.capture(
          'http_error',
          {
            url: sanitizeUrl(url),
            message: String(err),
            durationMs: Date.now() - start,
          },
          { force: true },
        );
        if (origFail) origFail(err);
      };
      raw(opts);
    };
  }

  return client;
}
