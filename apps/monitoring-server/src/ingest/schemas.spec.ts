import { describe, expect, it } from 'vitest';
import { ingestBatchSchema, monitoringEventSchema } from './schemas';

function minimalEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt12345678',
    type: 'error',
    timestamp: '2026-01-01T00:00:00.000Z',
    platform: 'web',
    sdkVersion: '1.0.0',
    sessionId: 'sess1234',
    payload: { message: 'x' },
    ...overrides,
  };
}

describe('monitoringEventSchema', () => {
  it('接受合法事件', () => {
    const r = monitoringEventSchema.safeParse(minimalEvent());
    expect(r.success).toBe(true);
  });

  it('strict 拒绝多余字段', () => {
    const r = monitoringEventSchema.safeParse({ ...minimalEvent(), extra: 1 });
    expect(r.success).toBe(false);
  });

  it('eventId 过短失败', () => {
    const r = monitoringEventSchema.safeParse(minimalEvent({ eventId: 'short' }));
    expect(r.success).toBe(false);
  });
});

describe('ingestBatchSchema', () => {
  it('接受单条 batch', () => {
    const r = ingestBatchSchema.safeParse({
      projectKey: 'my-app',
      events: [minimalEvent()],
    });
    expect(r.success).toBe(true);
  });

  it('events 为空失败', () => {
    const r = ingestBatchSchema.safeParse({ projectKey: 'k', events: [] });
    expect(r.success).toBe(false);
  });

  it('strict 拒绝 batch 多余字段', () => {
    const r = ingestBatchSchema.safeParse({
      projectKey: 'k',
      events: [minimalEvent()],
      foo: 1,
    });
    expect(r.success).toBe(false);
  });
});
