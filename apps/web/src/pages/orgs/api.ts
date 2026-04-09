import { http } from '../../api/client';

export async function createOrg(payload: { name: string; slug: string }) {
  return http.post('/orgs', payload).then((r) => r.data);
}

