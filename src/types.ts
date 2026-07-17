export type Id = string;
export type ISODate = string;
export type ISODateTime = string;
export type Theme = 'system' | 'light' | 'dark';
export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict';
export type Priority = 'normal' | 'important' | 'urgent';
export type Recurrence = '' | 'daily' | 'weekly' | 'monthly';
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TaskStatus = 'inbox' | 'next' | 'waiting' | 'someday';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type GoalArea = 'personal' | 'work' | 'health' | 'finance' | 'learning' | 'other';
export type TimeBlockType = 'focus' | 'meeting' | 'admin' | 'sport' | 'personal' | 'buffer';
export type DashboardWidget = 'timeline' | 'priorities' | 'habits' | 'goals' | 'mood' | 'insights';

export interface Meta {
  id: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
  revision: number;
  deviceId: string;
  syncStatus: SyncStatus;
}

export interface Subtask { id: Id; title: string; completed: boolean; }

export interface Task extends Meta {
  kind: 'task';
  title: string;
  completed: boolean;
  completedAt: ISODateTime | null;
  dueDate: ISODate | null;
  dueTime: string | null;
  reminderMinutes: number | null;
  project: string;
  estimatedMinutes: number;
  priority: Priority;
  urgent: boolean;
  important: boolean;
  recurrence: Recurrence;
  subtasks: Subtask[];
  order: number;
  description?: string;
  tags?: string[];
  status?: TaskStatus;
  context?: string;
  energy?: EnergyLevel;
  actualMinutes?: number;
  parentGoalId?: Id | null;
  startDate?: ISODate | null;
}

export interface CalendarEvent extends Meta {
  kind: 'event';
  title: string;
  date: ISODate;
  time: string | null;
  durationMinutes: number;
  category: 'personal' | 'work' | 'health' | 'other';
  location: string;
  notes: string;
  recurrence: Recurrence;
  reminderMinutes: number | null;
  countdown: boolean;
  allDay?: boolean;
  endDate?: ISODate | null;
  color?: string;
  url?: string;
}

export interface Note extends Meta {
  kind: 'note';
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  folder?: string;
  favorite?: boolean;
  sourceUrl?: string;
}

export interface Habit extends Meta {
  kind: 'habit';
  name: string;
  days: WeekDay[];
  weeklyGoal: number;
  completions: Record<ISODate, number>;
  unit: string;
  target: number;
  color?: string;
  icon?: string;
  skipped?: Record<ISODate, boolean>;
  reminderTime?: string | null;
}

export interface RoutineStep { id: Id; label: string; }
export interface Routine extends Meta {
  kind: 'routine';
  name: string;
  time: string | null;
  days: WeekDay[];
  steps: RoutineStep[];
  completions: Record<ISODate, Id[]>;
  durationMinutes?: number;
  color?: string;
}

export interface Exercise {
  id: Id;
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface Program extends Meta {
  kind: 'program';
  name: string;
  exercises: Exercise[];
  category?: string;
  goal?: string;
}

export interface WorkoutSession extends Meta {
  kind: 'session';
  date: ISODate;
  type: string;
  durationMinutes: number;
  notes: string;
  exercises: Exercise[];
  effort?: number;
  calories?: number | null;
}

export interface WeightEntry extends Meta { kind: 'weight'; date: ISODate; kg: number; }
export interface SleepEntry extends Meta { kind: 'sleep'; date: ISODate; hours: number; quality: number; }
export interface MealEntry extends Meta { kind: 'meal'; date: ISODate; mealType: string; description: string; }
export interface MeasurementEntry extends Meta { kind: 'measurement'; date: ISODate; name: string; value: number; unit: string; }

export interface FocusSession extends Meta {
  kind: 'focus';
  taskId: Id | null;
  taskTitle: string;
  date: ISODate;
  minutes: number;
}

export interface WeeklyReview extends Meta {
  kind: 'review';
  weekStart: ISODate;
  wins: string;
  blockers: string;
  priorities: string;
}

export interface Goal extends Meta {
  kind: 'goal';
  title: string;
  area: GoalArea;
  status: GoalStatus;
  targetDate: ISODate | null;
  progress: number;
  notes: string;
  project: string;
  color: string;
}

export interface TimeBlock extends Meta {
  kind: 'timeBlock';
  date: ISODate;
  start: string;
  end: string;
  title: string;
  type: TimeBlockType;
  linkedTaskIds: Id[];
  notes: string;
}

export interface MoodEntry extends Meta {
  kind: 'mood';
  date: ISODate;
  mood: number;
  energy: number;
  stress: number;
  note: string;
}

export interface Preferences {
  theme: Theme;
  mode: 'local' | 'synced';
  morningSummaryTime: string;
  eveningReviewTime: string;
  defaultTaskReminderTime: string;
  defaultEventReminderMinutes: number | null;
  notificationsEnabled: boolean;
  objectiveSessions: number;
  pinHash: string | null;
  lastExportAt: ISODateTime | null;
  activeProject: string | null;
  autoRollOverdue: boolean;
  top3: Record<ISODate, Id[]>;
  lastActiveDate: ISODate;
  installDismissed: boolean;
  dashboardWidgets?: DashboardWidget[];
  workingDayStart?: string;
  workingDayEnd?: string;
  weekStartsMonday?: boolean;
  defaultFocusMinutes?: number;
  compactMode?: boolean;
}

export interface AppState {
  schemaVersion: 6;
  deviceId: string;
  tasks: Task[];
  events: CalendarEvent[];
  notes: Note[];
  habits: Habit[];
  routines: Routine[];
  programs: Program[];
  sessions: WorkoutSession[];
  focusSessions: FocusSession[];
  weights: WeightEntry[];
  sleep: SleepEntry[];
  meals: MealEntry[];
  measurements: MeasurementEntry[];
  water: Record<ISODate, number>;
  projects: string[];
  reviews: WeeklyReview[];
  goals: Goal[];
  timeBlocks: TimeBlock[];
  moods: MoodEntry[];
  notificationLog: Record<string, ISODateTime>;
  preferences: Preferences;
}

export type Screen = 'today' | 'plan' | 'notes' | 'tracking';
export type PlanTab = 'tasks' | 'agenda' | 'goals';
export type TrackingTab = 'habits' | 'sport' | 'health' | 'analytics';
