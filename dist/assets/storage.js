import { migrateV5 } from './migration.js';
import { normalizeState } from './normalization.js';
const DB_NAME = 'quotidien-v6';
const STORE = 'state';
const KEY = 'current';
const FALLBACK_KEY = 'quotidien-v6-state';
const IDB_TIMEOUT_MS = 3500;
function withTimeout(promise, milliseconds = IDB_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('IndexedDB timeout')), milliseconds);
        promise.then(value => { window.clearTimeout(timer); resolve(value); }, error => { window.clearTimeout(timer); reject(error); });
    });
}
function openDb() {
    return withTimeout(new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE))
                request.result.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB blocked'));
    }));
}
async function fromIndexedDb() {
    const db = await openDb();
    try {
        return await withTimeout(new Promise((resolve, reject) => {
            const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        }));
    }
    finally {
        db.close();
    }
}
export async function loadState() {
    try {
        const state = await fromIndexedDb();
        if (state?.schemaVersion === 6)
            return normalizeState(state);
    }
    catch { /* fallback below */ }
    try {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw)
            return normalizeState(JSON.parse(raw));
    }
    catch { /* migration below */ }
    return normalizeState(migrateV5());
}
export async function saveState(state) {
    const normalized = normalizeState(state);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(normalized));
    try {
        const db = await openDb();
        try {
            await withTimeout(new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(normalized, KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }));
        }
        finally {
            db.close();
        }
    }
    catch { /* localStorage remains available */ }
}
export async function replaceState(state) {
    await saveState(normalizeState(state));
}
//# sourceMappingURL=storage.js.map