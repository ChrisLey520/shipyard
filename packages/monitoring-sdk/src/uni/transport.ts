import type { TransportSend } from '../core/types.js';
import { getUni } from './types.js';

export function createUniTransport(endpoint: string, ingestToken: string): TransportSend {
  return ({ body }) => {
    const uni = getUni();
    if (!uni) return Promise.resolve(false);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      uni.request({
        url: endpoint,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ingestToken}`,
        },
        data: parsed,
        success: (res) => {
          resolve(res.statusCode === 202 || (res.statusCode >= 200 && res.statusCode < 300));
        },
        fail: () => resolve(false),
      });
    });
  };
}
