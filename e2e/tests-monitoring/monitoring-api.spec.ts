import { expect, test } from '@playwright/test';

const adminToken = process.env['MONITORING_ADMIN_TOKEN'] ?? 'e2e-admin-token';
const projectKey = process.env['MONITORING_SEED_PROJECT_KEY'] ?? 'e2e_project';
const ingestToken = process.env['MONITORING_SEED_INGEST_TOKEN'] ?? 'e2e-ingest-token';

test.describe('monitoring-server API', () => {
  test.describe.configure({ mode: 'serial' });

  test('GET /health', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test('ingest batch 后可在 admin 列表看到', async ({ request }) => {
    const eventId = `e2e${Date.now()}`;
    const ingestRes = await request.post('/v1/ingest/batch', {
      headers: {
        Authorization: `Bearer ${ingestToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        projectKey,
        events: [
          {
            eventId,
            type: 'error',
            timestamp: new Date().toISOString(),
            platform: 'web',
            sdkVersion: '1.0.0',
            sessionId: 'sess-e2e-1',
            payload: { message: 'e2e monitoring' },
          },
        ],
      },
    });
    expect(ingestRes.status()).toBe(202);
    const ingestJson = (await ingestRes.json()) as { accepted?: number };
    expect(ingestJson.accepted ?? 0).toBeGreaterThanOrEqual(1);

    const listRes = await request.get('/v1/admin/events', {
      params: { projectKey, pageSize: '20' },
      headers: { 'x-admin-token': adminToken },
    });
    expect(listRes.ok()).toBeTruthy();
    const listJson = (await listRes.json()) as { items?: Array<{ eventId?: string }> };
    expect(Array.isArray(listJson.items)).toBe(true);
    expect(listJson.items?.some((row) => row.eventId === eventId)).toBe(true);
  });
});
