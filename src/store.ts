import type { AppState, CalendarEvent, Exercise, FocusSession, Goal, Habit, Id, MeasurementEntry, MealEntry, MoodEntry, Note, Program, Routine, SleepEntry, Task, TimeBlock, WeightEntry, WorkoutSession } from './types.js';
import { loadState, replaceState, saveState } from './storage.js';
import { meta, nextRecurrence, nowIso, today, touch, uid } from './utils.js';

export type Listener = (state: AppState) => void;

type Deletable = { id: Id; deletedAt: string | null; updatedAt: string; revision: number; syncStatus: 'local' | 'pending' | 'synced' | 'conflict' };

export class Store {
  private state!: AppState;
  private listeners = new Set<Listener>();

  async init(): Promise<void> { this.state = await loadState(); }
  get snapshot(): AppState { return structuredClone(this.state); }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); listener(this.snapshot); return () => this.listeners.delete(listener); }
  private async commit(): Promise<void> { await saveState(this.state); this.listeners.forEach(listener => listener(this.snapshot)); }
  private markDeleted<T extends Deletable>(items: T[], id: Id): void {
    const item = items.find(value => value.id === id); if (!item) return;
    item.deletedAt = nowIso(); item.updatedAt = nowIso(); item.revision += 1; item.syncStatus = 'pending';
  }

  async addTask(input: Partial<Task> & Pick<Task, 'title'>): Promise<void> {
    const task: Task = {
      ...meta(this.state.deviceId), kind: 'task', title: input.title.trim(), completed: false, completedAt: null,
      dueDate: input.dueDate ?? null, dueTime: input.dueTime ?? null, reminderMinutes: input.reminderMinutes ?? null,
      project: input.project || this.state.projects[0] || 'Personnel', estimatedMinutes: input.estimatedMinutes ?? 0,
      priority: input.priority ?? 'normal', urgent: input.urgent ?? input.priority === 'urgent', important: input.important ?? input.priority === 'important',
      recurrence: input.recurrence ?? '', subtasks: input.subtasks ?? [], order: Date.now(), description: input.description ?? '', tags: input.tags ?? [],
      status: input.status ?? 'next', context: input.context ?? '', energy: input.energy ?? 'medium', actualMinutes: input.actualMinutes ?? 0,
      parentGoalId: input.parentGoalId ?? null, startDate: input.startDate ?? null,
    };
    if (!task.title) return; this.state.tasks.unshift(task); await this.commit();
  }
  async updateTask(id: Id, patch: Partial<Task>): Promise<void> { const index = this.state.tasks.findIndex(item => item.id === id); if (index < 0) return; this.state.tasks[index] = touch({ ...this.state.tasks[index]!, ...patch }); await this.commit(); }
  async toggleTask(id: Id): Promise<void> {
    const task = this.state.tasks.find(item => item.id === id); if (!task) return;
    task.completed = !task.completed; task.completedAt = task.completed ? nowIso() : null;
    if (task.completed && task.recurrence) {
      const nextDate = nextRecurrence(task.dueDate ?? today(), task.recurrence);
      this.state.tasks.unshift({ ...task, ...meta(this.state.deviceId), completed: false, completedAt: null, dueDate: nextDate, subtasks: task.subtasks.map(sub => ({ ...sub, id: uid(), completed: false })), order: Date.now() });
      task.recurrence = '';
    }
    Object.assign(task, touch(task)); await this.commit();
  }
  async deleteTask(id: Id): Promise<void> { this.markDeleted(this.state.tasks, id); await this.commit(); }
  async duplicateTask(id: Id): Promise<void> { const task = this.state.tasks.find(item => item.id === id); if (!task) return; this.state.tasks.unshift({ ...task, ...meta(this.state.deviceId), title: `${task.title} — copie`, completed: false, completedAt: null, subtasks: task.subtasks.map(sub => ({ ...sub, id: uid(), completed: false })), order: Date.now() }); await this.commit(); }
  async addSubtask(taskId: Id, title: string): Promise<void> { const task = this.state.tasks.find(item => item.id === taskId); if (!task || !title.trim()) return; task.subtasks.push({ id: uid(), title: title.trim(), completed: false }); Object.assign(task, touch(task)); await this.commit(); }
  async toggleSubtask(taskId: Id, subtaskId: Id): Promise<void> { const task = this.state.tasks.find(item => item.id === taskId); const sub = task?.subtasks.find(item => item.id === subtaskId); if (!task || !sub) return; sub.completed = !sub.completed; Object.assign(task, touch(task)); await this.commit(); }

  async addEvent(input: Partial<CalendarEvent> & Pick<CalendarEvent, 'title' | 'date'>): Promise<void> {
    if (!input.title.trim()) return;
    this.state.events.push({ ...meta(this.state.deviceId), kind: 'event', title: input.title.trim(), date: input.date, time: input.time ?? null,
      durationMinutes: input.durationMinutes ?? 60, category: input.category ?? 'personal', location: input.location ?? '', notes: input.notes ?? '',
      recurrence: input.recurrence ?? '', reminderMinutes: input.reminderMinutes ?? 30, countdown: input.countdown ?? false,
      allDay: input.allDay ?? !input.time, endDate: input.endDate ?? null, color: input.color ?? '#2d6cdf', url: input.url ?? '' }); await this.commit();
  }
  async updateEvent(id: Id, patch: Partial<CalendarEvent>): Promise<void> { const index = this.state.events.findIndex(item => item.id === id); if (index < 0) return; this.state.events[index] = touch({ ...this.state.events[index]!, ...patch }); await this.commit(); }
  async deleteEvent(id: Id): Promise<void> { this.markDeleted(this.state.events, id); await this.commit(); }

  async addNote(input: Partial<Note> & { title?: string; body?: string }): Promise<void> {
    const title = input.title?.trim() || input.body?.trim().slice(0, 60) || ''; if (!title) return;
    this.state.notes.unshift({ ...meta(this.state.deviceId), kind: 'note', title, body: input.body?.trim() ?? '', tags: input.tags ?? [], pinned: input.pinned ?? false, archived: input.archived ?? false, folder: input.folder ?? 'Notes', favorite: input.favorite ?? false, sourceUrl: input.sourceUrl ?? '' }); await this.commit();
  }
  async updateNote(id: Id, patch: Partial<Note>): Promise<void> { const index = this.state.notes.findIndex(item => item.id === id); if (index < 0) return; this.state.notes[index] = touch({ ...this.state.notes[index]!, ...patch }); await this.commit(); }
  async deleteNote(id: Id): Promise<void> { this.markDeleted(this.state.notes, id); await this.commit(); }
  async duplicateNote(id: Id): Promise<void> { const note = this.state.notes.find(item => item.id === id); if (!note) return; this.state.notes.unshift({ ...note, ...meta(this.state.deviceId), title: `${note.title} — copie`, pinned: false, favorite: false }); await this.commit(); }

  async addHabit(input: Partial<Habit> & Pick<Habit, 'name'>): Promise<void> {
    if (!input.name.trim()) return;
    this.state.habits.push({ ...meta(this.state.deviceId), kind: 'habit', name: input.name.trim(), days: input.days ?? [1,2,3,4,5,6,0], weeklyGoal: input.weeklyGoal ?? 7, completions: {}, unit: input.unit ?? 'fois', target: input.target ?? 1, color: input.color ?? '#11a4b7', icon: input.icon ?? '✓', skipped: {}, reminderTime: input.reminderTime ?? null }); await this.commit();
  }
  async updateHabit(id: Id, patch: Partial<Habit>): Promise<void> { const index = this.state.habits.findIndex(item => item.id === id); if (index < 0) return; this.state.habits[index] = touch({ ...this.state.habits[index]!, ...patch }); await this.commit(); }
  async setHabitValue(id: Id, date: string, value: number): Promise<void> { const habit = this.state.habits.find(item => item.id === id); if (!habit) return; if (value <= 0) delete habit.completions[date]; else habit.completions[date] = value; if (habit.skipped) delete habit.skipped[date]; Object.assign(habit, touch(habit)); await this.commit(); }
  async skipHabit(id: Id, date = today()): Promise<void> { const habit = this.state.habits.find(item => item.id === id); if (!habit) return; habit.skipped ??= {}; habit.skipped[date] = !habit.skipped[date]; delete habit.completions[date]; Object.assign(habit, touch(habit)); await this.commit(); }
  async deleteHabit(id: Id): Promise<void> { this.markDeleted(this.state.habits, id); await this.commit(); }

  async addRoutine(input: Partial<Routine> & Pick<Routine, 'name'>): Promise<void> {
    if (!input.name.trim()) return;
    this.state.routines.push({ ...meta(this.state.deviceId), kind: 'routine', name: input.name.trim(), time: input.time ?? null, days: input.days ?? [1,2,3,4,5,6,0], steps: input.steps ?? [], completions: {}, durationMinutes: input.durationMinutes ?? 15, color: input.color ?? '#9b51cf' }); await this.commit();
  }
  async updateRoutine(id: Id, patch: Partial<Routine>): Promise<void> { const index = this.state.routines.findIndex(item => item.id === id); if (index < 0) return; this.state.routines[index] = touch({ ...this.state.routines[index]!, ...patch }); await this.commit(); }
  async toggleRoutineStep(id: Id, stepId: Id, date = today()): Promise<void> { const routine = this.state.routines.find(item => item.id === id); if (!routine) return; const done = new Set(routine.completions[date] ?? []); done.has(stepId) ? done.delete(stepId) : done.add(stepId); routine.completions[date] = [...done]; Object.assign(routine, touch(routine)); await this.commit(); }
  async deleteRoutine(id: Id): Promise<void> { this.markDeleted(this.state.routines, id); await this.commit(); }

  async addProgram(name: string, exercises: Exercise[], category = 'Personnalisé', goal = ''): Promise<void> { if (!name.trim()) return; this.state.programs.push({ ...meta(this.state.deviceId), kind: 'program', name: name.trim(), exercises, category, goal }); await this.commit(); }
  async updateProgram(id: Id, patch: Partial<Program>): Promise<void> { const index = this.state.programs.findIndex(item => item.id === id); if (index < 0) return; this.state.programs[index] = touch({ ...this.state.programs[index]!, ...patch }); await this.commit(); }
  async deleteProgram(id: Id): Promise<void> { this.markDeleted(this.state.programs, id); await this.commit(); }
  async addFocusSession(taskId: Id | null, taskTitle: string, minutes: number): Promise<void> { if (minutes <= 0) return; const entry: FocusSession = { ...meta(this.state.deviceId), kind: 'focus', taskId, taskTitle, date: today(), minutes }; this.state.focusSessions.unshift(entry); if (taskId) { const task = this.state.tasks.find(item => item.id === taskId); if (task) { task.actualMinutes = (task.actualMinutes ?? 0) + minutes; Object.assign(task, touch(task)); } } await this.commit(); }

  async addSession(input: Partial<WorkoutSession> & Pick<WorkoutSession, 'type' | 'durationMinutes'>): Promise<void> {
    if (input.durationMinutes <= 0) return; this.state.sessions.unshift({ ...meta(this.state.deviceId), kind: 'session', date: input.date ?? today(), type: input.type, durationMinutes: input.durationMinutes, notes: input.notes ?? '', exercises: input.exercises ?? [], effort: input.effort ?? 5, calories: input.calories ?? null }); await this.commit();
  }
  async updateSession(id: Id, patch: Partial<WorkoutSession>): Promise<void> { const index = this.state.sessions.findIndex(item => item.id === id); if (index < 0) return; this.state.sessions[index] = touch({ ...this.state.sessions[index]!, ...patch }); await this.commit(); }
  async deleteSession(id: Id): Promise<void> { this.markDeleted(this.state.sessions, id); await this.commit(); }

  async addWeight(kg: number, date = today()): Promise<void> { this.state.weights = this.state.weights.filter(item => item.date !== date || item.deletedAt); const entry: WeightEntry = { ...meta(this.state.deviceId), kind: 'weight', date, kg }; this.state.weights.push(entry); await this.commit(); }
  async addSleep(hours: number, quality: number, date = today()): Promise<void> { this.state.sleep = this.state.sleep.filter(item => item.date !== date || item.deletedAt); const entry: SleepEntry = { ...meta(this.state.deviceId), kind: 'sleep', date, hours, quality }; this.state.sleep.push(entry); await this.commit(); }
  async changeWater(delta: number, date = today()): Promise<void> { this.state.water[date] = Math.max(0, (this.state.water[date] ?? 0) + delta); await this.commit(); }
  async addMeal(mealType: string, description: string, date = today()): Promise<void> { if (!description.trim()) return; const entry: MealEntry = { ...meta(this.state.deviceId), kind: 'meal', date, mealType, description: description.trim() }; this.state.meals.unshift(entry); await this.commit(); }
  async deleteMeal(id: Id): Promise<void> { this.markDeleted(this.state.meals, id); await this.commit(); }
  async addMeasurement(name: string, value: number, unit = 'cm', date = today()): Promise<void> { if (!name.trim()) return; const entry: MeasurementEntry = { ...meta(this.state.deviceId), kind: 'measurement', date, name: name.trim(), value, unit }; this.state.measurements.push(entry); await this.commit(); }

  async addGoal(input: Partial<Goal> & Pick<Goal, 'title'>): Promise<void> {
    if (!input.title.trim()) return;
    this.state.goals.unshift({ ...meta(this.state.deviceId), kind: 'goal', title: input.title.trim(), area: input.area ?? 'personal', status: input.status ?? 'active', targetDate: input.targetDate ?? null, progress: Math.max(0, Math.min(100, input.progress ?? 0)), notes: input.notes ?? '', project: input.project ?? '', color: input.color ?? '#2d6cdf' });
    await this.commit();
  }
  async updateGoal(id: Id, patch: Partial<Goal>): Promise<void> { const index = this.state.goals.findIndex(item => item.id === id); if (index < 0) return; const next = { ...this.state.goals[index]!, ...patch }; next.progress = Math.max(0, Math.min(100, next.progress)); this.state.goals[index] = touch(next); await this.commit(); }
  async deleteGoal(id: Id): Promise<void> { this.markDeleted(this.state.goals, id); await this.commit(); }

  async addTimeBlock(input: Partial<TimeBlock> & Pick<TimeBlock, 'date' | 'start' | 'end' | 'title'>): Promise<void> {
    if (!input.title.trim() || input.end <= input.start) return;
    this.state.timeBlocks.push({ ...meta(this.state.deviceId), kind: 'timeBlock', date: input.date, start: input.start, end: input.end, title: input.title.trim(), type: input.type ?? 'focus', linkedTaskIds: input.linkedTaskIds ?? [], notes: input.notes ?? '' });
    await this.commit();
  }
  async updateTimeBlock(id: Id, patch: Partial<TimeBlock>): Promise<void> { const index = this.state.timeBlocks.findIndex(item => item.id === id); if (index < 0) return; this.state.timeBlocks[index] = touch({ ...this.state.timeBlocks[index]!, ...patch }); await this.commit(); }
  async deleteTimeBlock(id: Id): Promise<void> { this.markDeleted(this.state.timeBlocks, id); await this.commit(); }

  async addMood(mood: number, energy: number, stress: number, note = '', date = today()): Promise<void> {
    this.state.moods = this.state.moods.filter(item => item.date !== date || item.deletedAt);
    const entry: MoodEntry = { ...meta(this.state.deviceId), kind: 'mood', date, mood: Math.max(1, Math.min(5, mood)), energy: Math.max(1, Math.min(5, energy)), stress: Math.max(1, Math.min(5, stress)), note: note.trim() };
    this.state.moods.push(entry); await this.commit();
  }

  async restore(type: string, id: Id): Promise<void> {
    const groups: Record<string, Deletable[]> = { task: this.state.tasks, event: this.state.events, note: this.state.notes, habit: this.state.habits, routine: this.state.routines, program: this.state.programs, session: this.state.sessions, meal: this.state.meals, goal: this.state.goals, timeBlock: this.state.timeBlocks };
    const item = groups[type]?.find(value => value.id === id); if (!item) return; item.deletedAt = null; item.updatedAt = nowIso(); item.revision += 1; item.syncStatus = 'pending'; await this.commit();
  }

  async setTop3(date: string, ids: Id[]): Promise<void> { this.state.preferences.top3[date] = ids.slice(0, 3); await this.commit(); }
  async setPreference<K extends keyof AppState['preferences']>(key: K, value: AppState['preferences'][K]): Promise<void> { this.state.preferences[key] = value; await this.commit(); }
  async addProject(name: string): Promise<void> { const clean = name.trim(); if (!clean || this.state.projects.includes(clean)) return; this.state.projects.push(clean); await this.commit(); }
  async replace(next: AppState): Promise<void> { this.state = next; await replaceState(next); this.listeners.forEach(listener => listener(this.snapshot)); }
  async purgeDeleted(): Promise<void> {
    const cutoff = Date.now() - 30 * 86400000;
    const keep = <T extends { deletedAt: string | null }>(items: T[]): T[] => items.filter(item => !item.deletedAt || new Date(item.deletedAt).getTime() > cutoff);
    this.state.tasks = keep(this.state.tasks); this.state.events = keep(this.state.events); this.state.notes = keep(this.state.notes); this.state.habits = keep(this.state.habits); this.state.routines = keep(this.state.routines); this.state.programs = keep(this.state.programs); this.state.sessions = keep(this.state.sessions); this.state.meals = keep(this.state.meals); this.state.goals = keep(this.state.goals); this.state.timeBlocks = keep(this.state.timeBlocks);
    await this.commit();
  }
}
