const base = () => import.meta.env.VITE_MONITORING_API || '/monitoring-api';
const adminToken = () => import.meta.env.VITE_MONITORING_ADMIN_TOKEN || '';

function adminHeaders(): HeadersInit {
  return { 'X-Admin-Token': adminToken() };
}

export async function fetchEventList(params: URLSearchParams): Promise<{
  items: Array<{
    id: string;
    eventId: string;
    receivedAt: string;
    type: string;
    platform: string;
    release: string | null;
    route: string | null;
    message: string | null;
    projectKey: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const r = await fetch(`${base()}/v1/admin/events?${params.toString()}`, {
    headers: adminHeaders(),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{
    items: Array<{
      id: string;
      eventId: string;
      receivedAt: string;
      type: string;
      platform: string;
      release: string | null;
      route: string | null;
      message: string | null;
      projectKey: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export async function fetchEventDetail(id: string): Promise<{
  id: string;
  eventId: string;
  receivedAt: string;
  projectKey: string;
  event: unknown;
  symbolicatedStack?: { lines: string[]; notice: string | null } | null;
  breadcrumbs?: unknown;
}> {
  const r = await fetch(`${base()}/v1/admin/events/${id}`, {
    headers: adminHeaders(),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{
    id: string;
    eventId: string;
    receivedAt: string;
    projectKey: string;
    event: unknown;
    symbolicatedStack?: { lines: string[]; notice: string | null } | null;
    breadcrumbs?: unknown;
  }>;
}

export async function fetchHourlyMetrics(q: {
  projectKey: string;
  days?: number;
  type?: string;
  release?: string;
}): Promise<{
  buckets: Array<{ bucketStart: string; type: string; release: string; count: number }>;
}> {
  const p = new URLSearchParams();
  p.set('projectKey', q.projectKey);
  if (q.days != null) p.set('days', String(q.days));
  if (q.type) p.set('type', q.type);
  if (q.release !== undefined && q.release !== '') p.set('release', q.release);
  const r = await fetch(`${base()}/v1/admin/metrics/hourly?${p.toString()}`, {
    headers: adminHeaders(),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{
    buckets: Array<{ bucketStart: string; type: string; release: string; count: number }>;
  }>;
}

export async function fetchProjects(): Promise<{ items: Array<{ id: string; projectKey: string; createdAt: string }> }> {
  const r = await fetch(`${base()}/v1/admin/projects`, { headers: adminHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{ items: Array<{ id: string; projectKey: string; createdAt: string }> }>;
}

export async function createProject(projectKey: string): Promise<{ id: string; projectKey: string; ingestToken: string }> {
  const r = await fetch(`${base()}/v1/admin/projects`, {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectKey }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{ id: string; projectKey: string; ingestToken: string }>;
}

export async function rotateProjectToken(id: string): Promise<{ id: string; projectKey: string; ingestToken: string }> {
  const r = await fetch(`${base()}/v1/admin/projects/${id}/rotate-token`, {
    method: 'POST',
    headers: adminHeaders(),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{ id: string; projectKey: string; ingestToken: string }>;
}

export async function fetchAlertRules(projectKey?: string): Promise<
  Array<{
    id: string;
    name: string;
    eventType: string;
    windowMinutes: number;
    threshold: number;
    silenceMinutes: number;
    enabled: boolean;
    project: { projectKey: string };
    targets: Array<{ id: string; channel: string; webhookUrl: string }>;
  }>
> {
  const p = projectKey ? `?projectKey=${encodeURIComponent(projectKey)}` : '';
  const r = await fetch(`${base()}/v1/admin/alert-rules${p}`, { headers: adminHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<
    Array<{
      id: string;
      name: string;
      eventType: string;
      windowMinutes: number;
      threshold: number;
      silenceMinutes: number;
      enabled: boolean;
      project: { projectKey: string };
      targets: Array<{ id: string; channel: string; webhookUrl: string }>;
    }>
  >;
}

export async function createAlertRule(body: {
  projectKey: string;
  name: string;
  eventType: string;
  windowMinutes: number;
  threshold: number;
  silenceMinutes: number;
  targets: Array<{ channel: 'wecom' | 'feishu' | 'webhook'; webhookUrl: string }>;
}): Promise<unknown> {
  const r = await fetch(`${base()}/v1/admin/alert-rules`, {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
