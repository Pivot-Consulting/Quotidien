import type { AppSnapshot } from '../domain/types';
import { createNote, createTask } from '../domain/factories';
import { loadSnapshot, saveSnapshot } from '../storage/database';
import { migrateV5 } from '../storage/migrateV5';

type Listener = (state: AppSnapshot) => void;

export class AppStore {
  private state!: AppSnapshot;
  private listeners = new Set<Listener>();

  async init(): Promise<void> {
    this.state = await loadSnapshot();
    if (!this.state.tasks.length && !this.state.notes.length) {
      const migrated = migrateV5();
      if (migrated) {
        this.state = migrated;
        await saveSnapshot(this.state);
      }
    }
  }

  get snapshot(): AppSnapshot {
    return structuredClone(this.state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async addTask(title: string): Promise<void> {
    if (!title.trim()) return;
    this.state.tasks.unshift(createTask(title));
    await this.commit();
  }

  async toggleTask(id: string): Promise<void> {
    const task = this.state.tasks.find(item => item.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
    task.revision += 1;
    task.syncStatus = 'pending';
    await this.commit();
  }

  async addNote(title: string, body: string): Promise<void> {
    if (!title.trim() && !body.trim()) return;
    this.state.notes.unshift(createNote(title, body));
    await this.commit();
  }

  private async commit(): Promise<void> {
    await saveSnapshot(this.state);
    this.listeners.forEach(listener => listener(this.snapshot));
  }
}
