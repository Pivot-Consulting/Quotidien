import type { EntityMeta, Note, Task } from './types';

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const deviceId = () => localStorage.getItem('quotidien-device-id') || 'local-device';

function meta(): EntityMeta {
  const timestamp = now();
  return {
    id: id(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncStatus: 'local',
    deviceId: deviceId(),
    revision: 1,
  };
}

export function createTask(title: string, dueDate?: string): Task {
  return {
    ...meta(),
    kind: 'task',
    title: title.trim(),
    completed: false,
    completedAt: null,
    dueDate: dueDate || null,
    dueTime: null,
    project: 'Personnel',
    estimatedMinutes: 0,
    priority: 'normal',
  };
}

export function createNote(title: string, body = ''): Note {
  return {
    ...meta(),
    kind: 'note',
    title: title.trim() || 'Nouvelle note',
    body,
    tags: [],
    pinned: false,
  };
}
