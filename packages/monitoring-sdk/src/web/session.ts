import { createEventId } from '../core/id.js';

const SESSION_KEY = 'sy_m_sid';

export function getOrCreateWebSessionId(): string {
  try {
    if (typeof sessionStorage === 'undefined') return createEventId();
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = createEventId();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return createEventId();
  }
}
