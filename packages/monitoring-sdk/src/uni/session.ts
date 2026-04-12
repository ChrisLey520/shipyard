import { createEventId } from '../core/id.js';

/** 单次小程序 JS 运行实例内稳定 */
let launchSessionId: string | null = null;

export function getOrCreateUniSessionId(): string {
  if (launchSessionId) return launchSessionId;
  launchSessionId = createEventId();
  return launchSessionId;
}
