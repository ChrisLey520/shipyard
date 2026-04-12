import { BreadcrumbBuffer } from './breadcrumb.js';
import { createEventId } from './id.js';
import { idbClear, idbLoadPending, idbSavePending } from './idb-outbox.js';
import { sanitizeValue } from './sanitize.js';
import { shouldSample } from './sampling.js';
import type {
  MonitoringCoreConfig,
  MonitoringEvent,
  MonitoringEventType,
  MonitoringBreadcrumb,
  MonitoringPluginCleanup,
  MonitoringPluginContext,
} from './types.js';

export const MONITORING_SDK_VERSION = '0.1.0';

export class MonitoringClient {
  private readonly config: MonitoringCoreConfig;
  private readonly breadcrumbs: BreadcrumbBuffer;
  private queue: MonitoringEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private closed = false;
  private readonly pluginCleanups: MonitoringPluginCleanup[] = [];
  private readonly persist?: { dbName: string; maxItems: number };

  constructor(config: MonitoringCoreConfig) {
    this.config = config;
    if (config.persistQueue && typeof globalThis === 'object' && globalThis !== null && 'indexedDB' in globalThis) {
      this.persist = {
        dbName: config.persistQueue.dbName ?? 'shipyard-monitoring-outbox',
        maxItems: Math.min(500, Math.max(10, config.persistQueue.maxItems ?? 100)),
      };
      void this.restoreFromIdb();
    }
    this.breadcrumbs = new BreadcrumbBuffer(
      config.maxBreadcrumbs ?? 30,
      config.maxBreadcrumbDataChars ?? 1024,
    );
    const interval = config.flushIntervalMs ?? 5000;
    if (typeof setInterval !== 'undefined') {
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, interval);
    }
    this.installPlugins();
  }

  private async restoreFromIdb(): Promise<void> {
    if (!this.persist || this.closed) return;
    const pending = await idbLoadPending(this.persist.dbName);
    if (pending.length === 0) return;
    this.queue = [...pending, ...this.queue];
    void this.flush();
  }

  private createPluginContext(): MonitoringPluginContext {
    const ctx: MonitoringPluginContext = {
      capture: (type, payload, options) => {
        this.capture(type, payload, options);
      },
      addBreadcrumb: (entry) => {
        this.addBreadcrumb(entry);
      },
      flush: (useBeacon) => this.flush(useBeacon),
      platform: this.config.platform,
    };
    if (this.config.release !== undefined) ctx.release = this.config.release;
    if (this.config.env !== undefined) ctx.env = this.config.env;
    return ctx;
  }

  private installPlugins(): void {
    const list = this.config.plugins;
    if (!list?.length) return;
    const pluginCtx = this.createPluginContext();
    for (const plugin of list) {
      const cleanup = plugin.setup(pluginCtx);
      if (typeof cleanup === 'function') {
        this.pluginCleanups.push(cleanup);
      }
    }
  }

  addBreadcrumb(entry: Omit<MonitoringBreadcrumb, 't'> & { t?: string }): void {
    const extra = this.config.sensitiveKeys ?? [];
    const safeMessage =
      typeof entry.message === 'string' ? String(sanitizeValue(entry.message, extra)) : entry.message;
    const safeData =
      entry.data !== undefined ? (sanitizeValue(entry.data, extra) as Record<string, unknown>) : undefined;
    const row: Omit<MonitoringBreadcrumb, 't'> & { t?: string } = {
      category: entry.category,
      message: safeMessage as string,
    };
    if (safeData !== undefined) row.data = safeData;
    if (entry.t !== undefined) row.t = entry.t;
    this.breadcrumbs.add(row);
  }

  capture(
    type: MonitoringEventType,
    payload: Record<string, unknown>,
    options?: { sample?: boolean; force?: boolean },
  ): void {
    if (this.closed) return;
    const rate = this.config.sampleRate ?? 1;
    const force = options?.force === true;
    if (!force && options?.sample !== false && !shouldSample(rate)) return;

    const event = this.buildEvent(type, payload, rate);
    const max = this.config.maxBatchSize ?? 20;
    this.queue.push(event);
    if (this.persist) {
      void idbSavePending(this.persist.dbName, this.queue, this.persist.maxItems);
    }
    if (this.queue.length >= max) {
      void this.flush();
    }
  }

  private buildEvent(type: MonitoringEventType, payload: Record<string, unknown>, sampleRate: number): MonitoringEvent {
    const extra = this.config.sensitiveKeys ?? [];
    const bc = type === 'error' ? this.breadcrumbs.snapshot() : undefined;

    const event: MonitoringEvent = {
      eventId: createEventId(),
      type,
      timestamp: new Date().toISOString(),
      platform: this.config.platform,
      sdkVersion: this.config.sdkVersion ?? MONITORING_SDK_VERSION,
      sessionId: this.config.getSessionId(),
      payload: sanitizeValue(payload, extra) as Record<string, unknown>,
      sampleRate,
    };

    if (this.config.release !== undefined) event.release = this.config.release;
    if (this.config.env !== undefined) event.env = this.config.env;
    const route = this.config.getRoute?.();
    if (route !== undefined) event.route = route;
    const device = this.config.getDevice?.();
    if (device !== undefined) event.device = device;
    const network = this.config.getNetwork?.();
    if (network !== undefined) event.network = network;
    if (bc !== undefined && bc.length > 0) event.breadcrumbs = bc;

    return event;
  }

  async flush(useBeacon = false): Promise<void> {
    if (this.closed || this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    const body = JSON.stringify({
      projectKey: this.config.projectKey,
      events: batch,
    } satisfies { projectKey: string; events: MonitoringEvent[] });

    try {
      await this.config.transport({
        body,
        useBeacon,
        contentType: 'application/json',
      });
      if (this.persist) {
        if (this.queue.length === 0) {
          await idbClear(this.persist.dbName);
        } else {
          await idbSavePending(this.persist.dbName, this.queue, this.persist.maxItems);
        }
      }
    } catch {
      this.queue = [...batch, ...this.queue];
      if (this.persist) {
        await idbSavePending(this.persist.dbName, this.queue, this.persist.maxItems);
      }
    }
  }

  async shutdown(useBeacon = true): Promise<void> {
    if (this.flushTimer !== undefined) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    for (let i = this.pluginCleanups.length - 1; i >= 0; i--) {
      try {
        const fn = this.pluginCleanups[i];
        if (fn) fn();
      } catch {
        /* 插件 teardown 异常不阻塞 shutdown */
      }
    }
    this.pluginCleanups.length = 0;
    await this.flush(useBeacon);
    this.closed = true;
  }

  /** 供测试或扩展 */
  getQueueLength(): number {
    return this.queue.length;
  }
}

export function createMonitoringClient(config: MonitoringCoreConfig): MonitoringClient {
  return new MonitoringClient(config);
}
