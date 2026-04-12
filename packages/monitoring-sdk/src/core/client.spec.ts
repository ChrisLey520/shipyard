import { describe, expect, it, vi } from 'vitest';
import { MonitoringClient } from './client.js';

describe('MonitoringClient', () => {
  it('flushes batch via transport', async () => {
    const sent: string[] = [];
    const transport = vi.fn(async ({ body }: { body: string }) => {
      sent.push(body);
      return true;
    });

    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'test',
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 2,
      flushIntervalMs: 999999,
    });

    client.capture('custom', { a: 1 });
    client.capture('custom', { b: 2 });

    expect(transport).toHaveBeenCalled();
    const payload = JSON.parse(sent[0]!) as { projectKey: string; events: unknown[] };
    expect(payload.projectKey).toBe('p1');
    expect(payload.events).toHaveLength(2);
  });

  it('attaches breadcrumbs on error', async () => {
    const bodies: string[] = [];
    const transport = vi.fn(async ({ body }: { body: string }) => {
      bodies.push(body);
      return true;
    });

    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'test',
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 10,
      flushIntervalMs: 999999,
    });

    client.addBreadcrumb({ category: 'nav', message: 'home' });
    client.capture('error', { message: 'boom' }, { force: true });
    await client.flush();

    const payload = JSON.parse(bodies[0]!) as { events: Array<{ breadcrumbs?: unknown[] }> };
    expect(payload.events[0]?.breadcrumbs?.length).toBe(1);
  });

  it('skips queue when sampleRate is 0 and not forced', () => {
    const transport = vi.fn(async () => true);
    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'test',
      sampleRate: 0,
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 5,
      flushIntervalMs: 999999,
    });
    client.capture('custom', { x: 1 });
    expect(client.getQueueLength()).toBe(0);
    expect(transport).not.toHaveBeenCalled();
  });

  it('honors force:true when sampleRate is 0', async () => {
    const bodies: string[] = [];
    const transport = vi.fn(async ({ body }: { body: string }) => {
      bodies.push(body);
      return true;
    });
    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'test',
      sampleRate: 0,
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 10,
      flushIntervalMs: 999999,
    });
    client.capture('error', { message: 'x' }, { force: true });
    await client.flush();
    expect(bodies.length).toBe(1);
    const payload = JSON.parse(bodies[0]!) as { events: unknown[] };
    expect(payload.events).toHaveLength(1);
  });

  it('flush sends keepalive flag to transport', async () => {
    const transport = vi.fn(async () => true);
    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'test',
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 99,
      flushIntervalMs: 999999,
    });
    client.capture('custom', { a: 1 }, { force: true });
    await client.flush(true);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ useBeacon: true, body: expect.any(String) as string }),
    );
  });

  it('shutdown flushes and stops accepting captures', async () => {
    const transport = vi.fn(async () => true);
    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'test',
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 10,
      flushIntervalMs: 999999,
    });
    client.capture('custom', { z: 1 }, { force: true });
    await client.shutdown(false);
    expect(transport).toHaveBeenCalled();
    client.capture('custom', { z: 2 }, { force: true });
    expect(client.getQueueLength()).toBe(0);
  });

  it('runs plugin setup and ctx.capture enqueues', () => {
    const transport = vi.fn(async () => true);
    const setup = vi.fn();
    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'web',
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 10,
      flushIntervalMs: 999999,
      plugins: [
        {
          name: 't1',
          setup: (ctx) => {
            setup(ctx);
            ctx.capture('custom', { fromPlugin: true }, { force: true });
          },
        },
      ],
    });
    expect(setup).toHaveBeenCalled();
    expect(client.getQueueLength()).toBe(1);
  });

  it('shutdown calls teardown in reverse setup order', async () => {
    const order: string[] = [];
    const transport = vi.fn(async () => true);
    const client = new MonitoringClient({
      projectKey: 'p1',
      endpoint: 'http://localhost/x',
      ingestToken: 't',
      platform: 'test',
      getSessionId: () => 'sid',
      transport,
      maxBatchSize: 10,
      flushIntervalMs: 999999,
      plugins: [
        {
          name: 'first',
          setup: () => {
            order.push('setup-a');
            return () => {
              order.push('teardown-a');
            };
          },
        },
        {
          name: 'second',
          setup: () => {
            order.push('setup-b');
            return () => {
              order.push('teardown-b');
            };
          },
        },
      ],
    });
    expect(order).toEqual(['setup-a', 'setup-b']);
    await client.shutdown(false);
    expect(order).toEqual(['setup-a', 'setup-b', 'teardown-b', 'teardown-a']);
  });
});

