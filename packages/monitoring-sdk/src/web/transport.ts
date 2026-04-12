import type { TransportSend } from '../core/types.js';

/** 使用 fetch；卸载时使用 keepalive（sendBeacon 无法带 Authorization，故不用） */
export function createFetchTransport(endpoint: string, ingestToken: string): TransportSend {
  return async ({ body, useBeacon }) => {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ingestToken}`,
      },
      body,
      keepalive: useBeacon === true,
    };
    try {
      const r = await fetch(endpoint, init);
      return r.status === 202 || r.ok;
    } catch {
      return false;
    }
  };
}
