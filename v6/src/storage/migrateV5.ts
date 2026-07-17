import type { AppSnapshot, Note, Task } from '../domain/types';
import { emptySnapshot } from './database';

const LEGACY_KEY = 'mon-quotidien-v1';

export function migrateV5(): AppSnapshot | null {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;

  try {
    const legacy = JSON.parse(raw) as Record<string, unknown>;
    const snapshot = emptySnapshot();
    const now = new Date().toISOString();
    const deviceId = localStorage.getItem('quotidien-device-id') || 'legacy-device';

    snapshot.tasks = ((legacy.taches as Array<Record<string, unknown>>) || []).map((item): Task => ({
      id: String(item.id || crypto.randomUUID()),
      kind: 'task',
      title: String(item.libelle || 'Tâche'),
      completed: Boolean(item.fait),
      completedAt: item.faitLe ? `${String(item.faitLe)}T12:00:00.000Z` : null,
      dueDate: item.echeance ? String(item.echeance) : null,
      dueTime: null,
      project: String(item.projet || 'Personnel'),
      estimatedMinutes: Number(item.duree || 0),
      priority: item.urgent ? 'urgent' : item.important ? 'important' : 'normal',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local',
      deviceId,
      revision: 1,
    }));

    snapshot.notes = ((legacy.notes as Array<Record<string, unknown>>) || []).map((item): Note => ({
      id: String(item.id || crypto.randomUUID()),
      kind: 'note',
      title: String(item.titre || 'Note'),
      body: String(item.corps || ''),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      pinned: Boolean(item.epingle),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local',
      deviceId,
      revision: 1,
    }));

    return snapshot;
  } catch {
    return null;
  }
}
