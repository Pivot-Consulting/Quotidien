import type { AppEvent, Note, Task } from './types';

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export function createTask(title: string, dueDate?: string): Task {
  const timestamp = now();
  return {
    id: id(),
    kind: 'task',
    title: title.trim(),
    completed: false,
    dueDate: dueDate || null,
    priority: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

export function createNote(title: string, body = ''): Note {
  const timestamp = now();
  return {
    id: id(),
    kind: 'note',
    title: title.trim() || 'Nouvelle note',
    body,
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

export function createEvent(title: string, startsAt: string): AppEvent {
  const timestamp = now();
  return {
    id: id(),
    kind: 'event',
    title: title.trim(),
    startsAt,
    endsAt: null,
    location: '',
    reminderMinutes: 30,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}
