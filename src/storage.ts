import type { AppState } from './types.js';
import { migrateV5 } from './migration.js';
import { normalizeState } from './normalization.js';

const DB_NAME = 'quotidien-v6';
const STORE = 'state';
const KEY = 'current';
const FALLBACK_KEY = 'quotidien-v6-state';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function fromIndexedDb(): Promise<AppState | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve((request.result as AppState | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<AppState> {
  try {
    const state = await fromIndexedDb();
    if (state?.schemaVersion === 6) return normalizeState(state);
  } catch { /* fallback below */ }

  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) return normalizeState(JSON.parse(raw) as AppState);
  } catch { /* migration below */ }

  return normalizeState(migrateV5());
}

export async function saveState(state: AppState): Promise<void> {
  const normalized = normalizeState(state);
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(normalized));
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(normalized, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* localStorage remains available */ }
}

export async function replaceState(state: AppState): Promise<void> {
  await saveState(normalizeState(state));
}
