export type EntityId = string;
export type ISODate = string;
export type ISODateTime = string;

export type SyncStatus = "local" | "pending" | "synced" | "conflict";
export type TaskPriority = "normal" | "important" | "urgent";
export type AppSection = "today" | "tasks" | "notes" | "settings";

export interface EntityMeta {
  id: EntityId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
  syncStatus: SyncStatus;
  deviceId: string;
  revision: number;
}

export interface Task extends EntityMeta {
  kind: "task";
  title: string;
  completed: boolean;
  completedAt: ISODateTime | null;
  dueDate: ISODate | null;
  dueTime: string | null;
  project: string;
  estimatedMinutes: number;
  priority: TaskPriority;
}

export interface Note extends EntityMeta {
  kind: "note";
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  mode: "local" | "synced";
  morningSummaryTime: string;
  eveningReviewTime: string;
  defaultTaskReminderTime: string;
}

export interface AppSnapshot {
  tasks: Task[];
  notes: Note[];
  preferences: UserPreferences;
}
