import type { AppState, CalendarEvent, FocusSession, Habit, MeasurementEntry, MealEntry, Note, Program, Routine, SleepEntry, Task, WeightEntry, WorkoutSession } from './types.js';
import { meta, nowIso, today, uid } from './utils.js';

const LEGACY_KEY = 'mon-quotidien-v1';
const DEVICE_KEY = 'quotidien-device-id';

function deviceId(): string {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) { value = uid(); localStorage.setItem(DEVICE_KEY, value); }
  return value;
}

export function emptyState(): AppState {
  const device = deviceId();
  return {
    schemaVersion: 6, deviceId: device,
    tasks: [], events: [], notes: [], habits: [], routines: [], programs: [], sessions: [], focusSessions: [],
    weights: [], sleep: [], meals: [], measurements: [], water: {}, projects: ['Personnel', 'Travail'], reviews: [], notificationLog: {},
    preferences: {
      theme: 'system', mode: 'local', morningSummaryTime: '07:30', eveningReviewTime: '21:30',
      defaultTaskReminderTime: '09:00', defaultEventReminderMinutes: 30, notificationsEnabled: false, objectiveSessions: 3,
      pinHash: null, lastExportAt: null, activeProject: null, autoRollOverdue: false, top3: {}, lastActiveDate: today(), installDismissed: false,
    },
  };
}

const string = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const number = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const list = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value) ? value as Array<Record<string, unknown>> : [];


function normalizeRoutineCompletions(value: unknown, stepIds: string[]): Record<string, string[]> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, string[]> = {};
  for (const [date, raw] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(raw)) result[date] = raw.map(String);
    else if (raw === true) result[date] = stepIds.filter(Boolean);
    else if (raw && typeof raw === 'object') result[date] = Object.entries(raw as Record<string, unknown>).filter(([, done]) => Boolean(done)).map(([id]) => id);
  }
  return result;
}

export function migrateV5(): AppState {
  const state = emptyState();
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return state;
  try {
    const legacy = JSON.parse(raw) as Record<string, unknown>;
    const device = state.deviceId;
    const stamp = nowIso();
    state.projects = Array.isArray(legacy.projets) ? legacy.projets.map(String) : state.projects;
    state.tasks = list(legacy.taches).map((item, index): Task => ({
      ...meta(device), id: string(item.id, uid()), kind: 'task', title: string(item.libelle, 'Tâche'),
      completed: Boolean(item.fait), completedAt: item.faitLe ? `${String(item.faitLe)}T12:00:00` : null,
      dueDate: item.echeance ? String(item.echeance) : null, dueTime: null, reminderMinutes: null,
      project: string(item.projet, 'Personnel'), estimatedMinutes: number(item.duree),
      priority: item.urgent ? 'urgent' : item.important ? 'important' : 'normal', urgent: Boolean(item.urgent), important: Boolean(item.important),
      recurrence: item.repete === 'quotidien' ? 'daily' : item.repete === 'hebdo' ? 'weekly' : item.repete === 'mensuel' ? 'monthly' : '',
      subtasks: list(item.sous).map(sub => ({ id: string(sub.id, uid()), title: string(sub.l, 'Sous-tâche'), completed: Boolean(sub.f) })), order: number(item.ordre, index),
    }));
    state.events = list(legacy.evenements).map((item): CalendarEvent => ({
      ...meta(device), id: string(item.id, uid()), kind: 'event', title: string(item.titre, 'Événement'), date: string(item.date, today()),
      time: string(item.heure) || null, durationMinutes: number(item.duree), category: item.cat === 'travail' ? 'work' : item.cat === 'sante' ? 'health' : item.cat === 'perso' ? 'personal' : 'other',
      location: string(item.lieu), notes: '', recurrence: item.recur === 'quotidien' ? 'daily' : item.recur === 'hebdo' ? 'weekly' : item.recur === 'mensuel' ? 'monthly' : '',
      reminderMinutes: number(item.rappel, -1) >= 0 ? number(item.rappel) : null, countdown: Boolean(item.star),
    }));
    state.notes = list(legacy.notes).map((item): Note => ({
      ...meta(device), id: string(item.id, uid()), kind: 'note', title: string(item.titre, 'Note'), body: string(item.corps),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [], pinned: Boolean(item.epingle), archived: Boolean(item.archive),
    }));
    state.habits = list(legacy.habitudes).map((item): Habit => ({
      ...meta(device), id: string(item.id, uid()), kind: 'habit', name: string(item.nom, 'Habitude'), days: Array.isArray(item.joursSemaine) ? item.joursSemaine.map(Number).filter(value => value >= 0 && value <= 6) as Habit['days'] : [1,2,3,4,5,6,0], weeklyGoal: number(item.objectifHebdo, Array.isArray(item.joursSemaine) ? item.joursSemaine.length : 7),
      completions: Object.fromEntries(Object.entries((item.jours as Record<string, unknown>) || {}).filter(([, value]) => Boolean(value)).map(([date]) => [date, 1])), unit: 'fois', target: 1,
    }));
    state.routines = list(legacy.routines).map((item): Routine => ({
      ...meta(device), id: string(item.id, uid()), kind: 'routine', name: string(item.nom, 'Routine'), time: string(item.heure) || null,
      days: Array.isArray(item.joursSemaine) ? item.joursSemaine.map(Number).filter(value => value >= 0 && value <= 6) as Routine['days'] : [1,2,3,4,5,6,0],
      steps: list(item.etapes).map(step => ({ id: string(step.id, uid()), label: string(step.label ?? step.l, 'Étape') })),
      completions: normalizeRoutineCompletions(item.fait ?? item.completions, list(item.etapes).map(step => string(step.id, ''))),
    }));
    state.programs = list(legacy.programmesPerso).map((item): Program => ({
      ...meta(device), id: string(item.id, uid()), kind: 'program', name: string(item.nom, 'Programme'), exercises: list(item.exercices).map(ex => ({ id: uid(), name: string(ex.nom, 'Exercice'), sets: number(ex.series, 3), reps: number(ex.reps, 10), weight: number(ex.charge) })),
    }));
    state.sessions = list(legacy.seances).map((item): WorkoutSession => ({
      ...meta(device), id: string(item.id, uid()), kind: 'session', date: string(item.date, today()), type: string(item.type, 'Sport'), durationMinutes: number(item.duree), notes: string(item.notes),
      exercises: list(item.exos).map(ex => ({ id: uid(), name: string(ex.nom, 'Exercice'), sets: number(ex.series, 3), reps: number(ex.reps, 10), weight: number(ex.charge) })),
    }));
    state.focusSessions = list(legacy.focusSessions).map((item): FocusSession => ({ ...meta(device), id: string(item.id, uid()), kind: 'focus', taskId: item.taskId ? String(item.taskId) : null, taskTitle: string(item.taskTitle ?? item.titre, 'Focus'), date: string(item.date, today()), minutes: number(item.minutes ?? item.duree) }));
    state.weights = list(legacy.poids).map((item): WeightEntry => ({ ...meta(device), id: string(item.id, uid()), kind: 'weight', date: string(item.date, today()), kg: number(item.kg) }));
    state.sleep = list(legacy.sommeil).map((item): SleepEntry => ({ ...meta(device), id: string(item.id, uid()), kind: 'sleep', date: string(item.date, today()), hours: number(item.heures), quality: number(item.qualite, 3) }));
    state.meals = list(legacy.repas).map((item): MealEntry => ({ ...meta(device), id: string(item.id, uid()), kind: 'meal', date: string(item.date, today()), mealType: string(item.type, 'Repas'), description: string(item.desc) }));
    state.measurements = list(legacy.mesures).map((item): MeasurementEntry => ({ ...meta(device), id: string(item.id, uid()), kind: 'measurement', date: string(item.date, today()), name: string(item.nom, 'Mesure'), value: number(item.valeur), unit: 'cm' }));
    state.water = (legacy.eau as Record<string, number>) || {};
    for (const entry of list(legacy.corbeille)) {
      const item = (entry.item && typeof entry.item === 'object' ? entry.item : {}) as Record<string, unknown>;
      const deletedAt = string(entry.deletedAt, stamp);
      const deletedMeta = { ...meta(device), id: string(item.id, uid()), deletedAt };
      if (entry.kind === 'tache') state.tasks.push({ ...deletedMeta, kind:'task', title:string(item.libelle,'Tâche'), completed:Boolean(item.fait), completedAt:item.faitLe?`${String(item.faitLe)}T12:00:00`:null, dueDate:item.echeance?String(item.echeance):null, dueTime:null, reminderMinutes:null, project:string(item.projet,'Personnel'), estimatedMinutes:number(item.duree), priority:item.urgent?'urgent':item.important?'important':'normal', urgent:Boolean(item.urgent), important:Boolean(item.important), recurrence:item.repete==='quotidien'?'daily':item.repete==='hebdo'?'weekly':item.repete==='mensuel'?'monthly':'', subtasks:list(item.sous).map(sub=>({id:string(sub.id,uid()),title:string(sub.l,'Sous-tâche'),completed:Boolean(sub.f)})), order:number(item.ordre) });
      if (entry.kind === 'evenement') state.events.push({ ...deletedMeta, kind:'event', title:string(item.titre,'Événement'), date:string(item.date,today()), time:string(item.heure)||null, durationMinutes:number(item.duree), category:item.cat==='travail'?'work':item.cat==='sante'?'health':item.cat==='perso'?'personal':'other', location:string(item.lieu), notes:'', recurrence:item.recur==='quotidien'?'daily':item.recur==='hebdo'?'weekly':item.recur==='mensuel'?'monthly':'', reminderMinutes:number(item.rappel,-1)>=0?number(item.rappel):null, countdown:Boolean(item.star) });
      if (entry.kind === 'note') state.notes.push({ ...deletedMeta, kind:'note', title:string(item.titre,'Note'), body:string(item.corps), tags:Array.isArray(item.tags)?item.tags.map(String):[], pinned:Boolean(item.epingle), archived:Boolean(item.archive) });
      if (entry.kind === 'habitude') state.habits.push({ ...deletedMeta, kind:'habit', name:string(item.nom,'Habitude'), days:Array.isArray(item.joursSemaine)?item.joursSemaine.map(Number).filter(value=>value>=0&&value<=6) as Habit['days']:[1,2,3,4,5,6,0], weeklyGoal:number(item.objectifHebdo,7), completions:Object.fromEntries(Object.entries((item.jours as Record<string, unknown>)||{}).filter(([,value])=>Boolean(value)).map(([date])=>[date,1])), unit:'fois', target:1 });
      if (entry.kind === 'routine') { const rawSteps=list(item.etapes); const steps=rawSteps.map(step=>({id:string(step.id,uid()),label:string(step.label??step.l,'Étape')})); state.routines.push({ ...deletedMeta, kind:'routine', name:string(item.nom,'Routine'), time:string(item.heure)||null, days:Array.isArray(item.joursSemaine)?item.joursSemaine.map(Number).filter(value=>value>=0&&value<=6) as Routine['days']:[1,2,3,4,5,6,0], steps, completions:normalizeRoutineCompletions(item.fait??item.completions,steps.map(step=>step.id)) }); }
      if (entry.kind === 'programme') state.programs.push({ ...deletedMeta, kind:'program', name:string(item.nom,'Programme'), exercises:list(item.exercices).map(ex=>({id:uid(),name:string(ex.nom,'Exercice'),sets:number(ex.series,3),reps:number(ex.reps,10),weight:number(ex.charge)})) });
      if (entry.kind === 'seance') state.sessions.push({ ...deletedMeta, kind:'session', date:string(item.date,today()), type:string(item.type,'Sport'), durationMinutes:number(item.duree), notes:string(item.notes), exercises:list(item.exos).map(ex=>({id:uid(),name:string(ex.nom,'Exercice'),sets:number(ex.series,3),reps:number(ex.reps,10),weight:number(ex.charge)})) });
      if (entry.kind === 'repas') state.meals.push({ ...deletedMeta, kind:'meal', date:string(item.date,today()), mealType:string(item.type,'Repas'), description:string(item.desc) });
    }
    const prefs = (legacy.prefs as Record<string, unknown>) || {};
    state.preferences.theme = prefs.theme === 'sombre' ? 'dark' : 'light';
    state.preferences.notificationsEnabled = Boolean(prefs.notif);
    state.preferences.defaultTaskReminderTime = string(prefs.defaultTaskReminderHour, '09:00');
    state.preferences.defaultEventReminderMinutes = number(prefs.defaultEventReminder, 30) >= 0 ? number(prefs.defaultEventReminder, 30) : null;
    state.preferences.morningSummaryTime = string(prefs.morningSummary, '07:30');
    state.preferences.eveningReviewTime = string(prefs.eveningSummary, '21:30');
    state.preferences.autoRollOverdue = Boolean(prefs.autoRollOverdue);
    state.preferences.top3 = (prefs.top3 as Record<string, string[]>) || {};
    state.preferences.lastActiveDate = string(prefs.lastActiveDate, today());
    state.preferences.installDismissed = Boolean(prefs.installDismissed);
    state.preferences.pinHash = string(prefs.pin) || null;
    state.preferences.objectiveSessions = number(prefs.objectifSeances, 3);
    state.preferences.lastExportAt = prefs.dernierExport ? `${String(prefs.dernierExport)}T12:00:00` : null;
    state.notificationLog = (legacy.notifie as Record<string, string>) || {};
    localStorage.setItem('quotidien-v6-migrated-at', stamp);
    return state;
  } catch {
    return state;
  }
}
