const base = () => import.meta.env.VITE_MONITORING_API || '/monitoring-api';
const adminToken = () => import.meta.env.VITE_MONITORING_ADMIN_TOKEN || '';

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
    headers: { 'X-Admin-Token': adminToken() },
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
}> {
  const r = await fetch(`${base()}/v1/admin/events/${id}`, {
    headers: { 'X-Admin-Token': adminToken() },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{
    id: string;
    eventId: string;
    receivedAt: string;
    projectKey: string;
    event: unknown;
  }>;
}
