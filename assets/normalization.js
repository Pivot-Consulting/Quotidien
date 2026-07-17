import { emptyState } from './migration.js';
const taskDefaults = (task) => ({ description: '', tags: [], status: 'next', context: '', energy: 'medium', actualMinutes: 0, parentGoalId: null, startDate: null, ...task });
const eventDefaults = (event) => ({ allDay: !event.time, endDate: null, color: '#2d6cdf', url: '', ...event });
const noteDefaults = (note) => ({ folder: 'Notes', favorite: false, sourceUrl: '', ...note });
const habitDefaults = (habit) => ({ color: '#11a4b7', icon: '✓', skipped: {}, reminderTime: null, ...habit });
const routineDefaults = (routine) => ({ durationMinutes: 15, color: '#9b51cf', ...routine });
const programDefaults = (program) => ({ category: 'Personnalisé', goal: '', ...program });
const sessionDefaults = (session) => ({ effort: 5, calories: null, ...session });
export function normalizeState(value) {
    const defaults = emptyState();
    return {
        ...defaults,
        ...value,
        tasks: Array.isArray(value.tasks) ? value.tasks.map(taskDefaults) : [],
        events: Array.isArray(value.events) ? value.events.map(eventDefaults) : [],
        notes: Array.isArray(value.notes) ? value.notes.map(noteDefaults) : [],
        habits: Array.isArray(value.habits) ? value.habits.map(habitDefaults) : [],
        routines: Array.isArray(value.routines) ? value.routines.map(routineDefaults) : [],
        programs: Array.isArray(value.programs) ? value.programs.map(programDefaults) : [],
        sessions: Array.isArray(value.sessions) ? value.sessions.map(sessionDefaults) : [],
        focusSessions: Array.isArray(value.focusSessions) ? value.focusSessions : [],
        weights: Array.isArray(value.weights) ? value.weights : [],
        sleep: Array.isArray(value.sleep) ? value.sleep : [],
        meals: Array.isArray(value.meals) ? value.meals : [],
        measurements: Array.isArray(value.measurements) ? value.measurements : [],
        projects: Array.isArray(value.projects) && value.projects.length ? value.projects : defaults.projects,
        reviews: Array.isArray(value.reviews) ? value.reviews : [],
        goals: Array.isArray(value.goals) ? value.goals : [],
        timeBlocks: Array.isArray(value.timeBlocks) ? value.timeBlocks : [],
        moods: Array.isArray(value.moods) ? value.moods : [],
        water: value.water && typeof value.water === 'object' ? value.water : {},
        notificationLog: value.notificationLog && typeof value.notificationLog === 'object' ? value.notificationLog : {},
        preferences: { ...defaults.preferences, ...(value.preferences ?? {}) },
    };
}
//# sourceMappingURL=normalization.js.map