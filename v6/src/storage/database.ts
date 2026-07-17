import type { AppSnapshot } from '../domain/types';

const DB_NAME = 'quotidien-v6';
const STORE = 'snapshot';
const KEY = 'current';

export const emptySnapshot = (): AppSnapshot => ({
  tasks: [],
  notes: [],
  preferences: {
    theme: 'system',
    mode: 'local',
    morningSummaryTime: '07:30',
    eveningReviewTime: '21:30',
    defaultTaskReminderTime: '09:00',
  },
});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve((request.result as AppSnapshot | undefined) || emptySnapshot());
    request.onerror = () => reject(request.error);
  });
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(snapshot, KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
