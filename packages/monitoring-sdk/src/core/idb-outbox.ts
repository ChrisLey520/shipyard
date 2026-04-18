import type { MonitoringEvent } from './types.js';

const DEFAULT_DB = 'shipyard-monitoring-outbox';
const STORE = 'events';
const KEY = 'pending';

function canUseIdb(): boolean {
  return typeof globalThis === 'object' && globalThis !== null && 'indexedDB' in globalThis && !!globalThis.indexedDB;
}

export async function idbLoadPending(dbName: string): Promise<MonitoringEvent[]> {
  if (!canUseIdb()) return [];
  const idb = globalThis.indexedDB!;
  return new Promise((resolve) => {
    const req = idb.open(dbName, 1);
    req.onerror = () => resolve([]);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, 'readonly');
      const get = tx.objectStore(STORE).get(KEY);
      get.onsuccess = () => {
        const v = get.result;
        db.close();
        resolve(Array.isArray(v) ? (v as MonitoringEvent[]) : []);
      };
      get.onerror = () => {
        db.close();
        resolve([]);
      };
    };
  });
}

export async function idbSavePending(dbName: string, events: MonitoringEvent[], maxItems: number): Promise<void> {
  if (!canUseIdb()) return;
  const trimmed = events.slice(-maxItems);
  const idb = globalThis.indexedDB!;
  return new Promise((resolve) => {
    const req = idb.open(dbName, 1);
    req.onerror = () => resolve();
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(trimmed, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    };
  });
}

export async function idbClear(dbName: string): Promise<void> {
  if (!canUseIdb()) return;
  const idb = globalThis.indexedDB!;
  return new Promise((resolve) => {
    const req = idb.open(dbName, 1);
    req.onerror = () => resolve();
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    };
  });
}

export const idbDefaults = { dbName: DEFAULT_DB, maxItems: 100 };
