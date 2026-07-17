import { Store } from './store.js';
import { active, download, escapeHtml, formatDate, formatDuration, markdown, mondayOf, occursOn, parseDate, shiftDate, today, uid, weekday } from './utils.js';
const appRoot = document.querySelector('#app');
if (!appRoot)
    throw new Error('Conteneur #app introuvable');
const root = appRoot;
const store = new Store();
let state;
let screen = 'today';
let planTab = 'tasks';
let trackingTab = 'habits';
let taskFilter = 'open';
let taskView = 'list';
let agendaView = 'month';
let noteFilter = 'active';
let noteSearch = '';
let selectedDate = today();
let calendarMonth = new Date(parseDate(today()).getFullYear(), parseDate(today()).getMonth(), 1);
let modalSubmit = null;
let unlocked = false;
let focusTaskId = null;
let focusSeconds = 25 * 60;
let focusElapsed = 0;
let focusTimer = null;
let intervalTimer = null;
let deferredInstall = null;
let intervalState = null;
const WEEK_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const PRIORITY_LABEL = { normal: 'Normal', important: '⭐ Important', urgent: '🔥 Urgent' };
const RECURRENCE_LABEL = { '': 'Jamais', daily: 'Chaque jour', weekly: 'Chaque semaine', monthly: 'Chaque mois' };
const PRESET_PROGRAMS = [
    { name: 'Full body débutant', type: 'Musculation', duration: 35, exercises: [{ id: 'p1', name: 'Squat', sets: 3, reps: 12, weight: 0 }, { id: 'p2', name: 'Pompes', sets: 3, reps: 10, weight: 0 }, { id: 'p3', name: 'Rowing', sets: 3, reps: 12, weight: 0 }, { id: 'p4', name: 'Gainage', sets: 3, reps: 30, weight: 0 }] },
    { name: 'HIIT express', type: 'HIIT', duration: 20, exercises: [{ id: 'h1', name: 'Jumping jacks', sets: 4, reps: 30, weight: 0 }, { id: 'h2', name: 'Mountain climbers', sets: 4, reps: 30, weight: 0 }, { id: 'h3', name: 'Burpees', sets: 4, reps: 10, weight: 0 }] },
    { name: 'Course débutant', type: 'Course', duration: 30, exercises: [] },
    { name: 'Mobilité', type: 'Yoga', duration: 15, exercises: [] }
];
await store.init();
await refreshDay();
store.subscribe(next => { state = next; applyTheme(); render(); });
registerServiceWorker();
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
setTimeout(handleInitialUrl, 0);
setInterval(checkReminders, 30_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) {
    selectedDate = today();
    checkReminders();
    render();
} });
function applyTheme() {
    const theme = state.preferences.theme;
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1422' : '#10243f');
}
function render() {
    if (state.preferences.pinHash && !unlocked) {
        renderLock();
        return;
    }
    root.innerHTML = `
    <header class="topbar">
      <div><div class="brand">QUOTIDIEN <span>V6</span></div><div class="top-date">${escapeHtml(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))}</div></div>
      <div class="top-actions"><button class="icon-btn" data-action="search" aria-label="Rechercher">⌕</button><button class="icon-btn" data-action="settings" aria-label="Réglages">⚙</button></div>
    </header>
    <main class="main">${renderScreen()}</main>
    <nav class="bottom-nav" aria-label="Navigation">
      ${navButton('today', '⌂', 'Aujourd’hui')}
      ${navButton('plan', '▦', 'Planifier')}
      <button class="nav-add" data-action="quick-capture" aria-label="Ajouter">＋</button>
      ${navButton('notes', '◇', 'Notes')}
      ${navButton('tracking', '↗', 'Suivi')}
    </nav>
    <div class="modal-backdrop" id="modal-backdrop" hidden><section class="modal" role="dialog" aria-modal="true"><header><h2 id="modal-title"></h2><button class="icon-btn" data-action="close-modal">×</button></header><form id="modal-form"><div id="modal-body"></div><div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form></section></div>
    <div class="toast" id="toast" hidden></div>`;
    bindGlobalEvents();
}
function navButton(value, icon, label) {
    return `<button class="nav-item ${screen === value ? 'active' : ''}" data-screen="${value}"><span>${icon}</span>${label}</button>`;
}
function renderScreen() {
    if (screen === 'today')
        return renderToday();
    if (screen === 'plan')
        return renderPlan();
    if (screen === 'notes')
        return renderNotes();
    return renderTracking();
}
function renderToday() {
    const day = today();
    const allOpen = active(state.tasks).filter(task => !task.completed).sort(taskSort);
    const dueTasks = allOpen.filter(task => task.dueDate && task.dueDate <= day);
    const manualIds = state.preferences.top3[day] ?? [];
    const manual = manualIds.map(id => allOpen.find(task => task.id === id)).filter((task) => Boolean(task));
    const priorities = (manual.length ? manual : allOpen).slice(0, 3);
    const events = eventsOn(day);
    const habits = active(state.habits).filter(habit => habit.days.includes(weekday(day)));
    const routines = active(state.routines).filter(routine => routine.days.includes(weekday(day)));
    const next = events.find(event => !event.time || new Date(`${day}T${event.time}`).getTime() >= Date.now()) ?? events[0];
    const weekStart = mondayOf(day);
    const weekSessions = active(state.sessions).filter(session => session.date >= weekStart);
    const focusMinutes = active(state.focusSessions).filter(session => session.date >= weekStart).reduce((sum, item) => sum + item.minutes, 0);
    const doneTasks = active(state.tasks).filter(task => task.completedAt !== null && task.completedAt.slice(0, 10) >= weekStart).length;
    const habitChecks = habits.filter(habit => (habit.completions[day] ?? 0) >= habit.target).length;
    const load = priorities.reduce((sum, task) => sum + task.estimatedMinutes, 0);
    const agendaLoad = events.reduce((sum, event) => sum + (event.durationMinutes || 60), 0);
    const capacity = Math.max(0, 13 * 60 - agendaLoad);
    const countdowns = active(state.events).filter(event => event.countdown && !event.recurrence && event.date >= day).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    return `
    <section class="hero-card">
      <div><span class="eyebrow">AUJOURD’HUI</span><h1>Bonjour Raphaël</h1><p>${next ? `Prochain : <strong>${escapeHtml(next.time ?? 'Journée')} · ${escapeHtml(next.title)}</strong>` : 'Une journée claire commence par une prochaine action.'}</p></div>
      <button class="btn" data-action="quick-task">＋ Tâche</button>
    </section>
    ${countdowns.length ? `<section class="countdowns">${countdowns.map(event => { const days = Math.ceil((parseDate(event.date).getTime() - parseDate(day).getTime()) / 86400000); return `<div><strong>${days === 0 ? 'Aujourd’hui' : `J−${days}`}</strong><span>${escapeHtml(event.title)}</span></div>`; }).join('')}</section>` : ''}
    <section class="stats-row">
      ${stat(doneTasks, 'tâches finies')}${stat(weekSessions.reduce((sum, item) => sum + item.durationMinutes, 0), 'min de sport')}${stat(focusMinutes, 'min de focus')}${stat(`${habitChecks}/${habits.length}`, 'habitudes')}
    </section>
    <section class="card">
      <header class="section-head"><div><span class="eyebrow">MES 3 PRIORITÉS</span><h2>Ma journée</h2></div><div class="section-actions"><span class="load ${load > capacity ? 'danger' : ''}">${load ? `${formatDuration(load)} / ${formatDuration(capacity)}` : `${formatDuration(capacity)} libres`}</span><button class="mini-btn" data-action="plan-day">Planifier</button></div></header>
      ${priorities.length ? priorities.map(renderTaskRow).join('') : empty('Choisis trois priorités ou profite d’une journée légère.')}
      ${dueTasks.length > priorities.length ? `<details class="due-details"><summary>${dueTasks.length} tâche${dueTasks.length > 1 ? 's' : ''} à traiter aujourd’hui</summary>${dueTasks.filter(task => !priorities.some(item => item.id === task.id)).map(renderTaskRow).join('')}</details>` : ''}
    </section>
    <section class="grid-two">
      <section class="card"><header class="section-head"><h2>Agenda</h2><button class="link-btn" data-screen="plan" data-plan-tab="agenda">Ouvrir</button></header>${events.length ? events.map(event => renderEventRow(event)).join('') : empty('Aucun événement aujourd’hui.')}</section>
      <section class="card"><header class="section-head"><h2>Habitudes</h2></header>${habits.length ? habits.map(renderHabitToday).join('') : empty('Crée une habitude dans Suivi.')}</section>
    </section>
    ${routines.length ? `<section class="card"><header class="section-head"><h2>Routines</h2></header>${routines.map(renderRoutine).join('')}</section>` : ''}
    <section class="card review-card"><header class="section-head"><div><span class="eyebrow">REVUE</span><h2>Prendre du recul</h2></div><button class="mini-btn" data-action="weekly-review">Revue hebdo</button></header><p>Fais le point sur ce qui avance, ce qui bloque et les priorités de la semaine suivante.</p></section>
    <section class="card capture-card"><div><span class="eyebrow">BOÎTE DE RÉCEPTION</span><h2>Capturer sans classer</h2></div><form id="inbox-form" class="inline-form"><input name="text" placeholder="Une idée, une information, quelque chose à retenir…" autocomplete="off"><button class="btn">Capturer</button></form></section>`;
}
function stat(value, label) { return `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`; }
function renderPlan() {
    return `<div class="page-title"><div><span class="eyebrow">ORGANISER</span><h1>Planifier</h1></div></div>
    <div class="segmented"><button class="${planTab === 'tasks' ? 'active' : ''}" data-plan-tab="tasks">Tâches</button><button class="${planTab === 'agenda' ? 'active' : ''}" data-plan-tab="agenda">Agenda</button></div>
    ${planTab === 'tasks' ? renderTasks() : renderAgenda()}`;
}
function renderTasks() {
    let tasks = active(state.tasks);
    if (taskFilter === 'open')
        tasks = tasks.filter(task => !task.completed);
    if (taskFilter === 'today')
        tasks = tasks.filter(task => !task.completed && task.dueDate && task.dueDate <= today());
    if (taskFilter === 'done')
        tasks = tasks.filter(task => task.completed);
    const project = state.preferences.activeProject;
    if (project)
        tasks = tasks.filter(task => task.project === project);
    tasks.sort(taskSort);
    return `<section class="card">
    <form id="task-form" class="smart-form">
      <input name="title" class="span-2" placeholder="Nouvelle tâche…" required>
      <input name="dueDate" type="date" value="${today()}">
      <select name="project">${state.projects.map(item => `<option>${escapeHtml(item)}</option>`).join('')}</select>
      <input name="estimatedMinutes" type="number" min="0" placeholder="Durée min">
      <div class="task-flags"><label class="checkbox"><input name="urgent" type="checkbox"> 🔥 Urgent</label><label class="checkbox"><input name="important" type="checkbox"> ⭐ Important</label></div>
      <details class="span-2"><summary>Plus d’options</summary><div class="form-grid"><input name="dueTime" type="time"><select name="recurrence">${recurrenceOptions()}</select><select name="reminderMinutes"><option value="">Sans rappel</option><option value="0">À l’heure</option><option value="10">10 min avant</option><option value="30">30 min avant</option><option value="60">1 h avant</option><option value="1440">1 jour avant</option></select></div></details>
      <button class="btn span-2">Ajouter la tâche</button>
    </form>
  </section>
  <div class="chips">${filterButton('open', 'À faire')}${filterButton('today', 'Aujourd’hui')}${filterButton('done', 'Terminées')}${filterButton('all', 'Toutes')}<button class="chip ${taskView === 'list' ? 'active' : ''}" data-task-view="list">☰ Liste</button><button class="chip ${taskView === 'matrix' ? 'active' : ''}" data-task-view="matrix">▦ Matrice</button></div>
  <div class="chips project-chips"><button class="chip ${!project ? 'active' : ''}" data-project="">Toutes les listes</button>${state.projects.map(item => `<button class="chip ${project === item ? 'active' : ''}" data-project="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}<button class="chip" data-action="add-project">＋ Liste</button></div>
  <section class="card task-list">${tasks.length ? (taskView === 'matrix' ? renderTaskMatrix(tasks) : tasks.map(renderTaskRow).join('')) : empty('Aucune tâche dans cette vue.')}</section>`;
}
function filterButton(value, label) { return `<button class="chip ${taskFilter === value ? 'active' : ''}" data-task-filter="${value}">${label}</button>`; }
function recurrenceOptions(selected = '') { return Object.entries(RECURRENCE_LABEL).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join(''); }
function taskSort(a, b) {
    const score = (task) => (task.urgent ? 4 : 0) + (task.important ? 2 : 0) + (task.dueDate && task.dueDate <= today() ? 1 : 0);
    const priority = score(b) - score(a);
    if (priority)
        return priority;
    const dates = (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
    return dates || a.order - b.order;
}
function renderTaskMatrix(tasks) {
    const groups = [
        { title: '🔥⭐ Faire d’abord', items: tasks.filter(task => task.urgent && task.important) },
        { title: '⭐ Planifier', items: tasks.filter(task => !task.urgent && task.important) },
        { title: '🔥 Vite fait', items: tasks.filter(task => task.urgent && !task.important) },
        { title: 'En option', items: tasks.filter(task => !task.urgent && !task.important) },
    ];
    return `<div class="task-matrix">${groups.map(group => `<section><h3>${group.title}</h3>${group.items.length ? group.items.map(renderTaskRow).join('') : empty('—')}</section>`).join('')}</div>`;
}
function renderTaskRow(task) {
    const overdue = !task.completed && task.dueDate && task.dueDate < today();
    return `<article class="task-row ${task.completed ? 'done' : ''}">
    <button class="check-btn ${task.completed ? 'checked' : ''}" data-action="toggle-task" data-id="${task.id}" aria-label="Terminer">${task.completed ? '✓' : ''}</button>
    <div class="item-main"><button class="item-title" data-action="edit-task" data-id="${task.id}">${escapeHtml(task.title)}</button><div class="meta-row">
      <span class="badge project">${escapeHtml(task.project)}</span>${task.urgent ? '<span class="badge urgent">🔥 urgent</span>' : ''}${task.important ? '<span class="badge important">⭐ important</span>' : ''}${task.dueDate ? `<span class="${overdue ? 'overdue' : ''}">📅 ${formatDate(task.dueDate)}</span>` : ''}${task.dueTime ? `<span>· ${task.dueTime}</span>` : ''}${task.estimatedMinutes ? `<span>⏱ ${formatDuration(task.estimatedMinutes)}</span>` : ''}${task.recurrence ? `<span>↻ ${RECURRENCE_LABEL[task.recurrence]}</span>` : ''}
    </div>${task.subtasks.length ? `<div class="subtasks">${task.subtasks.map(sub => `<button class="subtask ${sub.completed ? 'done' : ''}" data-action="toggle-subtask" data-id="${task.id}" data-sub-id="${sub.id}">${sub.completed ? '☑' : '☐'} ${escapeHtml(sub.title)}</button>`).join('')}</div>` : ''}</div>
    ${!task.completed ? `<button class="mini-btn" data-action="focus" data-id="${task.id}">Focus</button>` : ''}<button class="delete-btn" data-action="delete-task" data-id="${task.id}" aria-label="Supprimer">×</button>
  </article>`;
}
function renderAgenda() {
    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(calendarMonth);
    const firstDay = (calendarMonth.getDay() + 6) % 7;
    const days = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1)
        cells.push('<span></span>');
    for (let day = 1; day <= days; day += 1) {
        const date = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const has = eventsOn(date).length > 0;
        cells.push(`<button class="cal-day ${date === today() ? 'today' : ''} ${date === selectedDate ? 'selected' : ''}" data-date="${date}">${day}${has ? '<i></i>' : ''}</button>`);
    }
    const weekStart = mondayOf(selectedDate);
    const weekMarkup = `<section class="card week-view"><header class="calendar-head"><button class="icon-btn" data-action="week-prev">‹</button><h2>Semaine du ${formatDate(weekStart)}</h2><button class="icon-btn" data-action="week-next">›</button></header>${Array.from({ length: 7 }, (_, index) => { const date = shiftDate(weekStart, index); const dayEvents = eventsOn(date); return `<button class="week-day ${date === selectedDate ? 'selected' : ''}" data-date="${date}"><strong>${formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</strong><span>${dayEvents.length ? dayEvents.map(event => `${event.time ?? '—'} · ${escapeHtml(event.title)}`).join('<br>') : '—'}</span></button>`; }).join('')}</section>`;
    const monthMarkup = `<section class="card calendar-card"><header class="calendar-head"><button class="icon-btn" data-action="month-prev">‹</button><h2>${escapeHtml(monthLabel)}</h2><button class="icon-btn" data-action="month-next">›</button></header><div class="calendar-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(value => `<strong>${value}</strong>`).join('')}${cells.join('')}</div></section>`;
    const events = eventsOn(selectedDate);
    const upcoming = upcomingEvents(10);
    return `<div class="chips agenda-switch"><button class="chip ${agendaView === 'month' ? 'active' : ''}" data-agenda-view="month">Mois</button><button class="chip ${agendaView === 'week' ? 'active' : ''}" data-agenda-view="week">Semaine</button></div>${agendaView === 'month' ? monthMarkup : weekMarkup}
    <section class="card"><header class="section-head"><div><span class="eyebrow">${formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</span><h2>Événements</h2></div><button class="btn small" data-action="add-event">＋ Ajouter</button></header>${events.length ? events.map(event => renderEventRow(event)).join('') : empty('Rien de prévu ce jour-là.')}</section>
    <section class="card"><header class="section-head"><h2>À venir</h2><div><button class="mini-btn" data-action="export-ics">Exporter .ics</button><button class="mini-btn" data-action="import-ics">Importer</button></div></header>${upcoming.length ? upcoming.map(({ event, date }) => `<div class="upcoming"><strong>${formatDate(date)}</strong>${renderEventRow(event, false)}</div>`).join('') : empty('Aucun événement à venir.')}</section>`;
}
function eventsOn(date) { return active(state.events).filter(event => occursOn(event.date, event.recurrence, date)).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')); }
function upcomingEvents(days) { const result = []; for (let i = 0; i <= days; i += 1) {
    const date = shiftDate(today(), i);
    eventsOn(date).forEach(event => result.push({ event, date }));
} return result.slice(0, 20); }
function renderEventRow(event, withDelete = true) {
    return `<article class="event-row"><time>${event.time ?? '—'}</time><div class="item-main"><button class="item-title" data-action="edit-event" data-id="${event.id}">${escapeHtml(event.title)}</button><div class="meta-row">${event.location ? `<span>📍 ${escapeHtml(event.location)}</span>` : ''}${event.durationMinutes ? `<span>${formatDuration(event.durationMinutes)}</span>` : ''}${event.recurrence ? `<span>↻ ${RECURRENCE_LABEL[event.recurrence]}</span>` : ''}${event.reminderMinutes !== null ? `<span>🔔 ${event.reminderMinutes === 0 ? 'à l’heure' : `${event.reminderMinutes} min avant`}</span>` : ''}</div></div><button class="mini-btn" data-action="share-event" data-id="${event.id}"></button>${withDelete ? `<button class="delete-btn" data-action="delete-event" data-id="${event.id}">×</button>` : ''}</article>`;
}
function renderNotes() {
    let notes = active(state.notes);
    if (noteFilter === 'active')
        notes = notes.filter(note => !note.archived);
    if (noteFilter === 'pinned')
        notes = notes.filter(note => note.pinned && !note.archived);
    if (noteFilter === 'archived')
        notes = notes.filter(note => note.archived);
    const query = noteSearch.trim().toLowerCase();
    if (query)
        notes = notes.filter(note => `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(query));
    notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    const tags = [...new Set(active(state.notes).flatMap(note => note.tags))];
    return `<div class="page-title"><div><span class="eyebrow">SECOND CERVEAU</span><h1>Notes</h1></div><div class="page-actions"><button class="mini-btn" data-action="daily-journal">📓 Journal</button><button class="btn" data-action="add-note">＋ Note</button></div></div>
    <section class="card"><div class="search-field"><span>⌕</span><input id="note-search" value="${escapeHtml(noteSearch)}" placeholder="Rechercher dans les notes…"></div><div class="chips">${noteFilterButton('active', 'Actives')}${noteFilterButton('pinned', '📌 Épinglées')}${noteFilterButton('archived', 'Archivées')}<button class="chip" data-action="note-graph">🕸 Graphe</button><button class="chip" data-action="export-markdown">Exporter Obsidian</button></div>${tags.length ? `<div class="tag-cloud">${tags.map(tag => `<button data-note-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join('')}</div>` : ''}</section>
    <section class="notes-grid">${notes.length ? notes.map(renderNoteCard).join('') : empty('Ton second cerveau attend sa première note.')}</section>`;
}
function noteFilterButton(value, label) { return `<button class="chip ${noteFilter === value ? 'active' : ''}" data-note-filter="${value}">${label}</button>`; }
function renderNoteCard(note) {
    const backlinks = active(state.notes).filter(other => other.id !== note.id && other.body.toLowerCase().includes(`[[${note.title.toLowerCase()}`));
    return `<article class="note-card ${note.pinned ? 'pinned' : ''}"><header><button class="note-title" data-action="edit-note" data-id="${note.id}">${note.pinned ? '📌 ' : ''}${escapeHtml(note.title)}</button><div><button class="mini-btn" data-action="pin-note" data-id="${note.id}">${note.pinned ? 'Désépingler' : 'Épingler'}</button><button class="delete-btn" data-action="delete-note" data-id="${note.id}">×</button></div></header><div class="note-body">${markdown(note.body)}</div>${note.tags.length ? `<div class="tags">${note.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}${backlinks.length ? `<footer>↩ ${backlinks.map(item => escapeHtml(item.title)).join(', ')}</footer>` : ''}</article>`;
}
function renderTracking() {
    return `<div class="page-title"><div><span class="eyebrow">PROGRESSION</span><h1>Suivi</h1></div></div><div class="segmented triple"><button class="${trackingTab === 'habits' ? 'active' : ''}" data-tracking-tab="habits">Habitudes</button><button class="${trackingTab === 'sport' ? 'active' : ''}" data-tracking-tab="sport">Sport</button><button class="${trackingTab === 'health' ? 'active' : ''}" data-tracking-tab="health">Santé</button></div>${trackingTab === 'habits' ? renderHabits() : trackingTab === 'sport' ? renderSport() : renderHealth()}`;
}
function renderHabits() {
    const habits = active(state.habits);
    const routines = active(state.routines);
    return `<section class="card"><header class="section-head"><h2>Habitudes</h2><button class="btn small" data-action="add-habit">＋ Ajouter</button></header>${habits.length ? habits.map(renderHabitFull).join('') : empty('Ajoute une habitude simple et mesurable.')}</section>
    <section class="card"><header class="section-head"><h2>Routines</h2><button class="btn small" data-action="add-routine">＋ Routine</button></header>${routines.length ? routines.map(renderRoutine).join('') : empty('Une routine regroupe plusieurs petites étapes.')}</section>`;
}
function renderHabitToday(habit) { const value = habit.completions[today()] ?? 0; const done = value >= habit.target; return `<div class="habit-row"><button class="habit-check ${done ? 'done' : ''}" data-action="toggle-habit" data-id="${habit.id}">${done ? '✓' : ''}</button><div><strong>${escapeHtml(habit.name)}</strong><span>${habit.target > 1 ? `${value}/${habit.target} ${escapeHtml(habit.unit)}` : `Série ${habitStreak(habit)} j`}</span></div></div>`; }
function renderHabitFull(habit) {
    const monday = mondayOf(today());
    const values = Array.from({ length: 7 }, (_, i) => habit.completions[shiftDate(monday, i)] ?? 0);
    return `<article class="habit-full"><div class="habit-main">${renderHabitToday(habit)}<button class="item-title" data-action="edit-habit" data-id="${habit.id}">Modifier</button><button class="delete-btn" data-action="delete-habit" data-id="${habit.id}">×</button></div><div class="week-dots">${values.map((value, i) => `<button class="${value >= habit.target ? 'done' : ''}" data-action="habit-day" data-id="${habit.id}" data-date="${shiftDate(monday, i)}"><span>${['L', 'M', 'M', 'J', 'V', 'S', 'D'][i]}</span><i>${value || ''}</i></button>`).join('')}</div></article>`;
}
function habitStreak(habit) { let date = today(); let streak = 0; if ((habit.completions[date] ?? 0) < habit.target)
    date = shiftDate(date, -1); while ((habit.completions[date] ?? 0) >= habit.target) {
    streak += 1;
    date = shiftDate(date, -1);
} return streak; }
function renderRoutine(routine) {
    const done = new Set(routine.completions[today()] ?? []);
    return `<article class="routine"><header><div><strong>${escapeHtml(routine.name)}</strong>${routine.time ? `<span>${routine.time}</span>` : ''}</div><div><button class="mini-btn" data-action="edit-routine" data-id="${routine.id}">Modifier</button><button class="delete-btn" data-action="delete-routine" data-id="${routine.id}">×</button></div></header>${routine.steps.map(step => `<button class="routine-step ${done.has(step.id) ? 'done' : ''}" data-action="routine-step" data-id="${routine.id}" data-step-id="${step.id}">${done.has(step.id) ? '☑' : '☐'} ${escapeHtml(step.label)}</button>`).join('')}</article>`;
}
function renderSport() {
    const sessions = active(state.sessions).sort((a, b) => b.date.localeCompare(a.date));
    const weekStart = mondayOf(today());
    const week = sessions.filter(item => item.date >= weekStart);
    const programs = active(state.programs);
    return `<section class="stats-row">${stat(week.length, `séances / ${state.preferences.objectiveSessions}`)}${stat(week.reduce((sum, item) => sum + item.durationMinutes, 0), 'minutes cette semaine')}${stat(sessions.length, 'séances au total')}</section>
    <section class="card"><header class="section-head"><h2>Minuteur d’intervalles</h2></header><div class="interval-display"><span id="interval-phase">${intervalState ? (intervalState.phase === 'effort' ? 'EFFORT' : 'REPOS') : 'PRÊT'}</span><strong id="interval-time">${formatClock(intervalState?.remaining ?? 30)}</strong><small>${intervalState ? `Tour ${intervalState.round}/${intervalState.rounds}` : ''}</small></div><div class="form-grid"><label>Effort<input id="interval-effort" type="number" value="30" min="5"></label><label>Repos<input id="interval-rest" type="number" value="30" min="0"></label><label>Tours<input id="interval-rounds" type="number" value="8" min="1"></label></div><div class="actions"><button class="btn" data-action="interval-start">${intervalTimer ? 'Pause' : intervalState ? 'Reprendre' : 'Démarrer'}</button><button class="btn ghost" data-action="interval-reset">Réinitialiser</button></div></section>
    <section class="card"><header class="section-head"><h2>Mes programmes</h2><button class="btn small" data-action="add-program">＋ Programme</button></header>${programs.length ? programs.map(program => `<article class="program"><div><strong>${escapeHtml(program.name)}</strong><p>${program.exercises.map(ex => `${escapeHtml(ex.name)} ${ex.sets}×${ex.reps}${ex.weight ? ` @ ${ex.weight} kg` : ''}`).join(' · ')}</p></div><button class="mini-btn" data-action="use-program" data-id="${program.id}">Lancer</button><button class="delete-btn" data-action="delete-program" data-id="${program.id}">×</button></article>`).join('') : empty('Crée ton premier programme.')}</section>
    <section class="card"><header class="section-head"><h2>Programmes prêts à l’emploi</h2></header>${PRESET_PROGRAMS.map((program, index) => `<article class="program"><div><strong>${escapeHtml(program.name)}</strong><p>${program.type} · ${program.duration} min</p></div><button class="mini-btn" data-action="use-preset" data-index="${index}">Utiliser</button></article>`).join('')}</section>
    <section class="card"><header class="section-head"><h2>Progression par exercice</h2></header>${renderExerciseProgress(sessions)}</section>
    <section class="card"><header class="section-head"><h2>Enregistrer une séance</h2></header>${sessionForm()}</section>
    <section class="card"><header class="section-head"><h2>Historique</h2></header>${sessions.length ? sessions.slice(0, 30).map(renderSession).join('') : empty('Aucune séance enregistrée.')}</section>`;
}
function renderExerciseProgress(sessions) {
    const names = [...new Set(sessions.flatMap(session => session.exercises.map(exercise => exercise.name)))];
    if (!names.length)
        return empty('Enregistre une séance avec des exercices pour suivre les charges.');
    return `<div class="exercise-progress">${names.slice(0, 8).map(name => {
        const points = sessions.filter(session => session.exercises.some(exercise => exercise.name === name)).reverse().map(session => session.exercises.find(exercise => exercise.name === name)?.weight ?? 0);
        return `<article><div><strong>${escapeHtml(name)}</strong><span>${points.at(-1) ?? 0} kg</span></div>${sparkline(points, 'kg')}</article>`;
    }).join('')}</div>`;
}
function sessionForm(prefill) { return `<form id="session-form" class="smart-form"><select name="type"><option>Musculation</option><option>Course</option><option>Vélo</option><option>Natation</option><option>Yoga</option><option>Marche</option><option>HIIT</option><option>Autre</option></select><input name="duration" type="number" min="1" placeholder="Durée en min" required><textarea class="span-2" name="notes" placeholder="Détails de la séance">${escapeHtml(prefill?.notes ?? '')}</textarea><input type="hidden" name="exercises" value="${escapeHtml(JSON.stringify(prefill?.exercises ?? []))}"><button class="btn span-2">Enregistrer</button></form>`; }
function renderSession(session) { return `<article class="session"><div><strong>${escapeHtml(session.type)} · ${formatDuration(session.durationMinutes)}</strong><span>${formatDate(session.date)}</span><p>${escapeHtml(session.notes)}</p></div><button class="delete-btn" data-action="delete-session" data-id="${session.id}">×</button></article>`; }
function formatClock(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function renderHealth() {
    const weights = active(state.weights).sort((a, b) => a.date.localeCompare(b.date));
    const sleeps = active(state.sleep).sort((a, b) => a.date.localeCompare(b.date));
    const meals = active(state.meals).filter(item => item.date === today());
    const measurements = active(state.measurements);
    const water = state.water[today()] ?? 0;
    return `<section class="grid-two"><section class="card"><header class="section-head"><h2>Poids</h2></header><form id="weight-form" class="inline-form"><input name="kg" type="number" step="0.1" min="20" placeholder="kg" required><button class="btn">＋</button></form>${sparkline(weights.slice(-20).map(item => item.kg), 'kg')}</section>
    <section class="card"><header class="section-head"><h2>Sommeil</h2></header><form id="sleep-form" class="form-grid"><input name="hours" type="number" step="0.25" min="0" max="16" placeholder="Heures" required><select name="quality"><option value="5">Excellente</option><option value="4">Bonne</option><option value="3" selected>Correcte</option><option value="2">Moyenne</option><option value="1">Mauvaise</option></select><button class="btn span-2">Enregistrer</button></form>${barChart(sleeps.slice(-7).map(item => item.hours))}</section></section>
    <section class="card"><header class="section-head"><h2>Hydratation</h2></header><div class="water"><button data-action="water-minus">−</button><strong>${water} verre${water > 1 ? 's' : ''}</strong><button data-action="water-plus">＋</button></div></section>
    <section class="card"><header class="section-head"><h2>Repas du jour</h2></header><form id="meal-form" class="smart-form"><select name="type"><option>Petit-déjeuner</option><option>Déjeuner</option><option>Dîner</option><option>Collation</option></select><input name="description" placeholder="Ce que tu as mangé" required><button class="btn span-2">Ajouter</button></form>${meals.map(meal => `<div class="meal"><span><strong>${escapeHtml(meal.mealType)}</strong> — ${escapeHtml(meal.description)}</span><button class="delete-btn" data-action="delete-meal" data-id="${meal.id}">×</button></div>`).join('')}</section>
    <section class="card"><header class="section-head"><h2>Mensurations</h2></header><form id="measurement-form" class="smart-form"><input name="name" placeholder="Tour de taille" required><input name="value" type="number" step="0.1" required><select name="unit"><option>cm</option><option>kg</option><option>%</option></select><button class="btn span-2">Enregistrer</button></form>${measurements.slice(-8).reverse().map(item => `<div class="measurement"><strong>${escapeHtml(item.name)}</strong><span>${item.value} ${escapeHtml(item.unit)} · ${formatDate(item.date)}</span></div>`).join('')}</section>`;
}
function sparkline(values, unit) { if (!values.length)
    return empty('Pas encore de données.'); const min = Math.min(...values), max = Math.max(...values), range = max - min || 1; const pts = values.map((v, i) => `${values.length === 1 ? 50 : i / (values.length - 1) * 100},${38 - (v - min) / range * 30}`).join(' '); return `<svg class="spark" viewBox="0 0 100 45"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/><text x="98" y="12" text-anchor="end">${values.at(-1)} ${unit}</text></svg>`; }
function barChart(values) { if (!values.length)
    return empty('Pas encore de données.'); const max = Math.max(...values, 1); return `<div class="bars">${values.map(value => `<i style="height:${Math.max(5, value / max * 100)}%"><span>${value}</span></i>`).join('')}</div>`; }
function empty(message) { return `<p class="empty">${escapeHtml(message)}</p>`; }
function bindGlobalEvents() {
    root.querySelectorAll('[data-screen]').forEach(element => element.addEventListener('click', () => { screen = element.dataset.screen; if (element.dataset.planTab)
        planTab = element.dataset.planTab; render(); }));
    root.querySelectorAll('[data-plan-tab]').forEach(element => element.addEventListener('click', () => { planTab = element.dataset.planTab; render(); }));
    root.querySelectorAll('[data-tracking-tab]').forEach(element => element.addEventListener('click', () => { trackingTab = element.dataset.trackingTab; render(); }));
    root.querySelectorAll('[data-task-filter]').forEach(element => element.addEventListener('click', () => { taskFilter = element.dataset.taskFilter; render(); }));
    root.querySelectorAll('[data-task-view]').forEach(element => element.addEventListener('click', () => { taskView = element.dataset.taskView; render(); }));
    root.querySelectorAll('[data-agenda-view]').forEach(element => element.addEventListener('click', () => { agendaView = element.dataset.agendaView; render(); }));
    root.querySelectorAll('[data-note-filter]').forEach(element => element.addEventListener('click', () => { noteFilter = element.dataset.noteFilter; render(); }));
    root.querySelectorAll('[data-project]').forEach(element => element.addEventListener('click', async () => store.setPreference('activeProject', element.dataset.project || null)));
    root.querySelectorAll('[data-date]').forEach(element => element.addEventListener('click', () => { selectedDate = element.dataset.date; render(); }));
    root.querySelectorAll('[data-note-tag]').forEach(element => element.addEventListener('click', () => { noteSearch = element.dataset.noteTag ?? ''; render(); }));
    root.querySelectorAll('.wiki-link[data-note-title]').forEach(element => element.addEventListener('click', () => { noteSearch = element.dataset.noteTitle ?? ''; screen = 'notes'; render(); }));
    root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); void handleAction(button.dataset.action, button); }));
    root.querySelector('#task-form')?.addEventListener('submit', handleTaskForm);
    root.querySelector('#inbox-form')?.addEventListener('submit', handleInboxForm);
    root.querySelector('#session-form')?.addEventListener('submit', handleSessionForm);
    root.querySelector('#weight-form')?.addEventListener('submit', handleWeightForm);
    root.querySelector('#sleep-form')?.addEventListener('submit', handleSleepForm);
    root.querySelector('#meal-form')?.addEventListener('submit', handleMealForm);
    root.querySelector('#measurement-form')?.addEventListener('submit', handleMeasurementForm);
    root.querySelector('#note-search')?.addEventListener('input', event => { const value = event.target.value; noteSearch = value; render(); requestAnimationFrame(() => { const input = root.querySelector('#note-search'); if (input) {
        input.focus();
        input.setSelectionRange(value.length, value.length);
    } }); });
    root.querySelector('#modal-form')?.addEventListener('submit', async (event) => { event.preventDefault(); if (modalSubmit)
        await modalSubmit(event.currentTarget); closeModal(); });
}
async function handleAction(action, element) {
    const id = element.dataset.id ?? '';
    if (action === 'settings')
        return openSettings();
    if (action === 'search')
        return openSearch();
    if (action === 'close-modal')
        return closeModal();
    if (action === 'quick-capture')
        return openQuickCapture();
    if (action === 'quick-task')
        return openTaskModal();
    if (action === 'plan-day')
        return openPlanDay();
    if (action === 'weekly-review')
        return openWeeklyReview();
    if (action === 'toggle-task')
        return store.toggleTask(id);
    if (action === 'delete-task')
        return store.deleteTask(id);
    if (action === 'edit-task')
        return openTaskModal(state.tasks.find(item => item.id === id));
    if (action === 'toggle-subtask')
        return store.toggleSubtask(id, element.dataset.subId);
    if (action === 'focus')
        return startFocus(id);
    if (action === 'add-project') {
        const name = prompt('Nom de la nouvelle liste');
        if (name)
            await store.addProject(name);
        return;
    }
    if (action === 'month-prev') {
        calendarMonth.setMonth(calendarMonth.getMonth() - 1);
        return render();
    }
    if (action === 'month-next') {
        calendarMonth.setMonth(calendarMonth.getMonth() + 1);
        return render();
    }
    if (action === 'week-prev') {
        selectedDate = shiftDate(selectedDate, -7);
        return render();
    }
    if (action === 'week-next') {
        selectedDate = shiftDate(selectedDate, 7);
        return render();
    }
    if (action === 'add-event')
        return openEventModal();
    if (action === 'edit-event')
        return openEventModal(state.events.find(item => item.id === id));
    if (action === 'delete-event')
        return store.deleteEvent(id);
    if (action === 'share-event') {
        const event = state.events.find(item => item.id === id);
        if (event)
            shareEvent(event);
        return;
    }
    if (action === 'export-ics')
        return exportIcs();
    if (action === 'import-ics')
        return importIcs();
    if (action === 'add-note')
        return openNoteModal();
    if (action === 'daily-journal')
        return openDailyJournal();
    if (action === 'note-graph')
        return openNoteGraph();
    if (action === 'export-markdown')
        return exportMarkdown();
    if (action === 'edit-note')
        return openNoteModal(state.notes.find(item => item.id === id));
    if (action === 'pin-note') {
        const note = state.notes.find(item => item.id === id);
        if (note)
            await store.updateNote(id, { pinned: !note.pinned });
        return;
    }
    if (action === 'delete-note')
        return store.deleteNote(id);
    if (action === 'add-habit')
        return openHabitModal();
    if (action === 'edit-habit')
        return openHabitModal(state.habits.find(item => item.id === id));
    if (action === 'toggle-habit') {
        const habit = state.habits.find(item => item.id === id);
        if (habit)
            await store.setHabitValue(id, today(), (habit.completions[today()] ?? 0) >= habit.target ? 0 : habit.target);
        return;
    }
    if (action === 'habit-day') {
        const habit = state.habits.find(item => item.id === id);
        const date = element.dataset.date;
        if (habit)
            await store.setHabitValue(id, date, (habit.completions[date] ?? 0) >= habit.target ? 0 : habit.target);
        return;
    }
    if (action === 'delete-habit')
        return store.deleteHabit(id);
    if (action === 'add-routine')
        return openRoutineModal();
    if (action === 'edit-routine')
        return openRoutineModal(state.routines.find(item => item.id === id));
    if (action === 'routine-step')
        return store.toggleRoutineStep(id, element.dataset.stepId);
    if (action === 'delete-routine')
        return store.deleteRoutine(id);
    if (action === 'add-program')
        return openProgramModal();
    if (action === 'use-program')
        return useProgram(id);
    if (action === 'use-preset')
        return usePreset(Number(element.dataset.index));
    if (action === 'delete-program')
        return store.deleteProgram(id);
    if (action === 'delete-session')
        return store.deleteSession(id);
    if (action === 'interval-start')
        return toggleInterval();
    if (action === 'interval-reset')
        return resetInterval();
    if (action === 'water-minus')
        return store.changeWater(-1);
    if (action === 'water-plus')
        return store.changeWater(1);
    if (action === 'delete-meal')
        return store.deleteMeal(id);
    if (action === 'export-data')
        return exportData();
    if (action === 'import-data')
        return importData();
    if (action === 'enable-notifications')
        return enableNotifications();
    if (action === 'set-pin')
        return setPin();
    if (action === 'clear-pin') {
        await store.setPreference('pinHash', null);
        unlocked = true;
        return;
    }
    if (action === 'purge-trash') {
        await store.purgeDeleted();
        toast('Corbeille nettoyée');
        return;
    }
    if (action === 'restore-item') {
        await store.restore(element.dataset.type ?? '', id);
        toast('Élément restauré');
        return;
    }
    if (action === 'install-app')
        return installApp();
}
async function handleTaskForm(event) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const urgent = data.get('urgent') === 'on'; const important = data.get('important') === 'on'; await store.addTask({ title: String(data.get('title') || ''), dueDate: String(data.get('dueDate') || '') || null, dueTime: String(data.get('dueTime') || '') || null, reminderMinutes: data.get('reminderMinutes') === '' ? null : Number(data.get('reminderMinutes')), project: String(data.get('project') || 'Personnel'), estimatedMinutes: Number(data.get('estimatedMinutes') || 0), urgent, important, priority: urgent ? 'urgent' : important ? 'important' : 'normal', recurrence: String(data.get('recurrence')) }); }
async function handleInboxForm(event) { event.preventDefault(); const form = event.currentTarget; const text = String(new FormData(form).get('text') || ''); await store.addNote({ title: text.slice(0, 60), body: text, tags: ['inbox'] }); }
async function handleSessionForm(event) { event.preventDefault(); const data = new FormData(event.currentTarget); let exercises = []; try {
    exercises = JSON.parse(String(data.get('exercises') || '[]'));
}
catch { } await store.addSession({ type: String(data.get('type')), durationMinutes: Number(data.get('duration')), notes: String(data.get('notes') || ''), exercises }); }
async function handleWeightForm(event) { event.preventDefault(); const kg = Number(new FormData(event.currentTarget).get('kg')); if (kg)
    await store.addWeight(kg); }
async function handleSleepForm(event) { event.preventDefault(); const data = new FormData(event.currentTarget); await store.addSleep(Number(data.get('hours')), Number(data.get('quality'))); }
async function handleMealForm(event) { event.preventDefault(); const data = new FormData(event.currentTarget); await store.addMeal(String(data.get('type')), String(data.get('description'))); }
async function handleMeasurementForm(event) { event.preventDefault(); const data = new FormData(event.currentTarget); await store.addMeasurement(String(data.get('name')), Number(data.get('value')), String(data.get('unit'))); }
function openModal(title, body, submit, submitLabel = 'Enregistrer') {
    const backdrop = root.querySelector('#modal-backdrop');
    backdrop.hidden = false;
    root.querySelector('#modal-title').textContent = title;
    const modalBody = root.querySelector('#modal-body');
    modalBody.innerHTML = body;
    const submitButton = root.querySelector('#modal-form button[type="submit"]');
    submitButton.textContent = submitLabel;
    modalSubmit = submit;
    modalBody.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); void handleAction(button.dataset.action, button); }));
}
function closeModal() { const backdrop = root.querySelector('#modal-backdrop'); if (backdrop)
    backdrop.hidden = true; modalSubmit = null; }
function openQuickCapture() {
    openModal('Capture rapide', `<div class="capture-grid"><button type="button" data-capture="task">✓ Tâche</button><button type="button" data-capture="event">▦ Événement</button><button type="button" data-capture="note">◇ Note</button><button type="button" data-capture="session">↗ Séance</button><button type="button" data-capture="measurement">⌁ Mesure</button><button type="button" data-capture="routine">↻ Routine</button></div>`, () => { }, 'Fermer');
    root.querySelectorAll('[data-capture]').forEach(button => button.addEventListener('click', () => {
        const type = button.dataset.capture;
        if (type === 'task')
            openTaskModal();
        if (type === 'event')
            openEventModal();
        if (type === 'note')
            openNoteModal();
        if (type === 'routine')
            openRoutineModal();
        if (type === 'measurement')
            openMeasurementModal();
        if (type === 'session') {
            closeModal();
            screen = 'tracking';
            trackingTab = 'sport';
            render();
            setTimeout(() => root.querySelector('#session-form')?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    }));
}
function openTaskModal(task) {
    openModal(task ? 'Modifier la tâche' : 'Nouvelle tâche', `<div class="form-grid">
    <label class="span-2">Titre<input name="title" value="${escapeHtml(task?.title ?? '')}" required></label>
    <label>Date<input name="dueDate" type="date" value="${task?.dueDate ?? today()}"></label>
    <label>Heure<input name="dueTime" type="time" value="${task?.dueTime ?? ''}"></label>
    <label>Liste<select name="project">${state.projects.map(item => `<option ${task?.project === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>
    <label>Durée<input name="estimatedMinutes" type="number" min="0" value="${task?.estimatedMinutes ?? 0}"></label>
    <label class="checkbox"><input type="checkbox" name="urgent" ${task?.urgent ? 'checked' : ''}> 🔥 Urgent</label>
    <label class="checkbox"><input type="checkbox" name="important" ${task?.important ? 'checked' : ''}> ⭐ Important</label>
    <label>Répéter<select name="recurrence">${recurrenceOptions(task?.recurrence)}</select></label>
    <label>Rappel<select name="reminderMinutes"><option value="">Aucun</option>${[0, 10, 30, 60, 1440].map(value => `<option value="${value}" ${task?.reminderMinutes === value ? 'selected' : ''}>${value === 0 ? 'À l’heure' : value === 1440 ? '1 jour avant' : `${value} min avant`}</option>`).join('')}</select></label>
    <label class="span-2">Sous-tâches<textarea name="subtasks" placeholder="Une ligne par sous-tâche">${escapeHtml(task?.subtasks.map(item => item.title).join('\n') ?? '')}</textarea></label>
  </div>`, async (form) => {
        const data = new FormData(form);
        const urgent = data.get('urgent') === 'on';
        const important = data.get('important') === 'on';
        const patch = {
            title: String(data.get('title')), dueDate: String(data.get('dueDate')) || null, dueTime: String(data.get('dueTime')) || null,
            project: String(data.get('project')), estimatedMinutes: Number(data.get('estimatedMinutes')), urgent, important,
            priority: urgent ? 'urgent' : important ? 'important' : 'normal',
            recurrence: String(data.get('recurrence')),
            reminderMinutes: data.get('reminderMinutes') === '' ? null : Number(data.get('reminderMinutes')),
            subtasks: String(data.get('subtasks') || '').split('\n').map(value => value.trim()).filter(Boolean).map((title, index) => ({ id: task?.subtasks[index]?.id ?? uid(), title, completed: task?.subtasks[index]?.completed ?? false })),
        };
        task ? await store.updateTask(task.id, patch) : await store.addTask(patch);
    });
}
function openEventModal(event) {
    const reminder = event ? event.reminderMinutes : state.preferences.defaultEventReminderMinutes;
    openModal(event ? 'Modifier l’événement' : 'Nouvel événement', `<div class="form-grid">
    <label class="span-2">Titre<input name="title" value="${escapeHtml(event?.title ?? '')}" required></label>
    <label>Date<input name="date" type="date" value="${event?.date ?? selectedDate}"></label>
    <label>Heure<input name="time" type="time" value="${event?.time ?? ''}"></label>
    <label>Durée<input name="duration" type="number" min="0" value="${event?.durationMinutes ?? 60}"></label>
    <label>Catégorie<select name="category"><option value="personal">Personnel</option><option value="work" ${event?.category === 'work' ? 'selected' : ''}>Travail</option><option value="health" ${event?.category === 'health' ? 'selected' : ''}>Santé</option><option value="other" ${event?.category === 'other' ? 'selected' : ''}>Autre</option></select></label>
    <label class="span-2">Lieu<input name="location" value="${escapeHtml(event?.location ?? '')}"></label>
    <label>Répéter<select name="recurrence">${recurrenceOptions(event?.recurrence)}</select></label>
    <label>Rappel<select name="reminder"><option value="" ${reminder === null ? 'selected' : ''}>Aucun</option>${[0, 10, 30, 60, 1440].map(value => `<option value="${value}" ${reminder === value ? 'selected' : ''}>${value === 0 ? 'À l’heure' : value === 1440 ? '1 jour avant' : `${value} min avant`}</option>`).join('')}</select></label>
    <label class="checkbox span-2"><input name="countdown" type="checkbox" ${event?.countdown ? 'checked' : ''}> Afficher un compte à rebours</label>
    <label class="span-2">Notes<textarea name="notes">${escapeHtml(event?.notes ?? '')}</textarea></label>
  </div>`, async (form) => {
        const data = new FormData(form);
        const patch = { title: String(data.get('title')), date: String(data.get('date')), time: String(data.get('time')) || null, durationMinutes: Number(data.get('duration')), category: String(data.get('category')), location: String(data.get('location')), notes: String(data.get('notes')), recurrence: String(data.get('recurrence')), reminderMinutes: data.get('reminder') === '' ? null : Number(data.get('reminder')), countdown: data.get('countdown') === 'on' };
        event ? await store.updateEvent(event.id, patch) : await store.addEvent(patch);
    });
}
function openNoteModal(note) {
    openModal(note ? 'Modifier la note' : 'Nouvelle note', `<div class="form-grid">
    ${note ? '' : `<label class="span-2">Modèle<select id="note-template"><option value="">Page vide</option><option value="meeting">Réunion</option><option value="idea">Idée</option><option value="reading">Lecture</option></select></label>`}
    <label class="span-2">Titre<input name="title" value="${escapeHtml(note?.title ?? '')}"></label>
    <label class="span-2">Contenu<textarea name="body" class="large" placeholder="# Titre · **gras** · [[Lien vers une note]]">${escapeHtml(note?.body ?? '')}</textarea></label>
    <label class="span-2">Tags<input name="tags" value="${escapeHtml(note?.tags.join(', ') ?? '')}"></label>
    <label class="checkbox"><input type="checkbox" name="pinned" ${note?.pinned ? 'checked' : ''}> Épinglée</label>
    <label class="checkbox"><input type="checkbox" name="archived" ${note?.archived ? 'checked' : ''}> Archivée</label>
  </div>`, async (form) => {
        const data = new FormData(form);
        const patch = { title: String(data.get('title')), body: String(data.get('body')), tags: String(data.get('tags')).split(',').map(value => value.trim()).filter(Boolean), pinned: data.get('pinned') === 'on', archived: data.get('archived') === 'on' };
        note ? await store.updateNote(note.id, patch) : await store.addNote(patch);
    });
    const template = root.querySelector('#note-template');
    template?.addEventListener('change', () => {
        const body = root.querySelector('#modal-form [name="body"]');
        if (!body)
            return;
        const templates = {
            meeting: '# Objectif\n\n# Points abordés\n- \n\n# Décisions\n- [ ] \n\n# Prochaines étapes\n- [ ] ',
            idea: '# L’idée en une phrase\n\n# Pourquoi c’est intéressant\n\n# Première petite étape\n- [ ] ',
            reading: '# Livre / article\n\n**Auteur :** \n\n# Les 3 idées clés\n- \n- \n- \n\n# Ce que j’en retire',
        };
        body.value = templates[template.value] ?? '';
    });
}
function weekdayChecks(selected = [1, 2, 3, 4, 5, 6, 0]) { return WEEK_LABELS.map((label, index) => `<label class="day-check"><input type="checkbox" name="day" value="${index}" ${selected.includes(index) ? 'checked' : ''}><span>${label}</span></label>`).join(''); }
function openHabitModal(habit) { openModal(habit ? 'Modifier l’habitude' : 'Nouvelle habitude', `<div class="form-grid"><label class="span-2">Nom<input name="name" value="${escapeHtml(habit?.name ?? '')}" required></label><div class="span-2 day-picker">${weekdayChecks(habit?.days)}</div><label>Objectif hebdo<input name="weeklyGoal" type="number" min="1" max="7" value="${habit?.weeklyGoal ?? 7}"></label><label>Cible par jour<input name="target" type="number" min="1" value="${habit?.target ?? 1}"></label><label class="span-2">Unité<input name="unit" value="${escapeHtml(habit?.unit ?? 'fois')}"></label></div>`, async (form) => { const data = new FormData(form); const patch = { name: String(data.get('name')), days: data.getAll('day').map(Number), weeklyGoal: Number(data.get('weeklyGoal')), target: Number(data.get('target')), unit: String(data.get('unit')) }; habit ? await store.updateHabit(habit.id, patch) : await store.addHabit(patch); }); }
function openRoutineModal(routine) {
    openModal(routine ? 'Modifier la routine' : 'Nouvelle routine', `<div class="form-grid">
    <label class="span-2">Nom<input name="name" value="${escapeHtml(routine?.name ?? '')}" required placeholder="Routine du matin"></label>
    <label>Heure<input name="time" type="time" value="${routine?.time ?? ''}"></label>
    <div class="span-2 day-picker">${weekdayChecks(routine?.days)}</div>
    <label class="span-2">Étapes<textarea name="steps" placeholder="Une étape par ligne" required>${escapeHtml(routine?.steps.map(step => step.label).join('\n') ?? '')}</textarea></label>
  </div>`, async (form) => {
        const data = new FormData(form);
        const steps = String(data.get('steps')).split('\n').map(label => label.trim()).filter(Boolean).map((label, index) => ({ id: routine?.steps[index]?.id ?? uid(), label }));
        if (routine) {
            const next = store.snapshot;
            const index = next.routines.findIndex(item => item.id === routine.id);
            if (index >= 0)
                next.routines[index] = { ...next.routines[index], name: String(data.get('name')), time: String(data.get('time')) || null, days: data.getAll('day').map(Number), steps, updatedAt: new Date().toISOString(), revision: next.routines[index].revision + 1, syncStatus: 'pending' };
            await store.replace(next);
        }
        else {
            await store.addRoutine({ name: String(data.get('name')), time: String(data.get('time')) || null, days: data.getAll('day').map(Number), steps });
        }
    });
}
function openMeasurementModal() {
    openModal('Nouvelle mesure', `<div class="form-grid"><label>Mesure<input name="name" placeholder="Tour de taille" required></label><label>Valeur<input name="value" type="number" step="0.1" required></label><label>Unité<select name="unit"><option>cm</option><option>kg</option><option>%</option></select></label><label>Date<input name="date" type="date" value="${today()}"></label></div>`, async (form) => { const data = new FormData(form); await store.addMeasurement(String(data.get('name')), Number(data.get('value')), String(data.get('unit')), String(data.get('date')) || today()); });
}
function openProgramModal() { openModal('Nouveau programme', `<div class="form-grid"><label class="span-2">Nom<input name="name" placeholder="Push day" required></label><label class="span-2">Exercices<textarea name="exercises" class="large" placeholder="Développé couché | 4 | 8 | 60\nTractions | 4 | 10 | 0" required></textarea><small>Format : Exercice | séries | répétitions | charge</small></label></div>`, async (form) => { const data = new FormData(form); const exercises = String(data.get('exercises')).split('\n').map(line => line.split('|').map(value => value.trim())).filter(parts => parts[0]).map(parts => ({ id: uid(), name: parts[0], sets: Number(parts[1] || 3), reps: Number(parts[2] || 10), weight: Number(parts[3] || 0) })); await store.addProgram(String(data.get('name')), exercises); }); }
async function refreshDay() {
    const current = today();
    const previous = store.snapshot.preferences.lastActiveDate;
    if (previous === current)
        return;
    const next = store.snapshot;
    if (next.preferences.autoRollOverdue) {
        next.tasks.forEach(task => {
            if (!task.completed && task.dueDate && task.dueDate < current) {
                task.dueDate = current;
                task.updatedAt = new Date().toISOString();
                task.revision += 1;
                task.syncStatus = 'pending';
            }
        });
    }
    next.preferences.lastActiveDate = current;
    await store.replace(next);
    selectedDate = current;
    calendarMonth = new Date(parseDate(current).getFullYear(), parseDate(current).getMonth(), 1);
}
function handleInitialUrl() {
    const params = new URLSearchParams(location.search);
    const requestedScreen = params.get('screen');
    const capture = params.get('capture');
    const date = params.get('date');
    if (requestedScreen && ['today', 'plan', 'notes', 'tracking'].includes(requestedScreen))
        screen = requestedScreen;
    if (date)
        selectedDate = date;
    if (requestedScreen === 'plan' && params.get('tab') === 'agenda')
        planTab = 'agenda';
    render();
    if (capture === 'task')
        setTimeout(openTaskModal, 50);
    if (capture === 'event')
        setTimeout(openEventModal, 50);
    if (capture === 'note')
        setTimeout(openNoteModal, 50);
    if (location.search)
        history.replaceState({}, '', location.pathname);
}
function openPlanDay() {
    const openTasks = active(state.tasks).filter(task => !task.completed).sort(taskSort);
    const selected = new Set(state.preferences.top3[today()] ?? openTasks.slice(0, 3).map(task => task.id));
    openModal('Planifier ma journée', `<p class="modal-intro">Choisis jusqu’à trois tâches prioritaires. La charge estimée est comparée au temps laissé libre par l’agenda.</p><div class="plan-choice">${openTasks.length ? openTasks.map(task => `<label><input type="checkbox" name="top3" value="${task.id}" ${selected.has(task.id) ? 'checked' : ''}><span><strong>${escapeHtml(task.title)}</strong><small>${task.dueDate ? formatDate(task.dueDate) : 'Sans échéance'}${task.estimatedMinutes ? ` · ${formatDuration(task.estimatedMinutes)}` : ''}</small></span></label>`).join('') : empty('Aucune tâche active.')}</div>`, async (form) => {
        const ids = new FormData(form).getAll('top3').map(String).slice(0, 3);
        await store.setTop3(today(), ids);
    });
    const boxes = [...root.querySelectorAll('input[name="top3"]')];
    boxes.forEach(box => box.addEventListener('change', () => {
        const checked = boxes.filter(item => item.checked);
        if (checked.length > 3) {
            box.checked = false;
            toast('Maximum : trois priorités.');
        }
    }));
}
function openWeeklyReview() {
    const weekStart = mondayOf(today());
    const completed = active(state.tasks).filter(task => Boolean(task.completedAt && task.completedAt.slice(0, 10) >= weekStart)).length;
    const sessions = active(state.sessions).filter(session => session.date >= weekStart);
    openModal('Revue hebdomadaire', `<div class="review-summary"><strong>${completed}</strong> tâches terminées · <strong>${sessions.length}</strong> séance(s) · <strong>${sessions.reduce((sum, item) => sum + item.durationMinutes, 0)}</strong> min de sport</div><label>Ce qui a bien avancé<textarea name="wins"></textarea></label><label>Ce qui a bloqué<textarea name="blockers"></textarea></label><label>Les 3 priorités de la semaine prochaine<textarea name="priorities"></textarea></label>`, async (form) => {
        const data = new FormData(form);
        const wins = String(data.get('wins') ?? '');
        const blockers = String(data.get('blockers') ?? '');
        const priorities = String(data.get('priorities') ?? '');
        const next = store.snapshot;
        next.reviews.unshift({ ...createImportedMeta(next.deviceId), kind: 'review', weekStart, wins, blockers, priorities });
        next.notes.unshift({ ...createImportedMeta(next.deviceId), kind: 'note', title: `Revue — semaine du ${formatDate(weekStart)}`, body: `# Ce qui a bien avancé\n${wins || '—'}\n\n# Ce qui a bloqué\n${blockers || '—'}\n\n# Priorités\n${priorities || '—'}`, tags: ['revue'], pinned: false, archived: false });
        await store.replace(next);
    });
}
async function openDailyJournal() {
    const title = `Journal — ${formatDate(today())}`;
    const existing = active(state.notes).find(note => note.title === title);
    if (existing) {
        openNoteModal(existing);
        return;
    }
    await store.addNote({ title, body: '# Humeur du jour\n\n# 3 bonnes choses\n- \n- \n- \n\n# En vrac\n', tags: ['journal'] });
    const created = active(store.snapshot.notes).find(note => note.title === title);
    if (created)
        openNoteModal(created);
}
function openNoteGraph() {
    const notes = active(state.notes).filter(note => !note.archived).slice(0, 24);
    if (notes.length < 2) {
        alert('Ajoute au moins deux notes pour afficher le graphe.');
        return;
    }
    const size = 320, center = size / 2, radius = 112;
    const positions = new Map(notes.map((note, index) => [note.id, { x: center + radius * Math.cos(index / notes.length * Math.PI * 2 - Math.PI / 2), y: center + radius * Math.sin(index / notes.length * Math.PI * 2 - Math.PI / 2) }]));
    const links = [];
    for (const source of notes)
        for (const target of notes)
            if (source.id !== target.id && source.body.toLowerCase().includes(`[[${target.title.toLowerCase()}`)) {
                const a = positions.get(source.id), b = positions.get(target.id);
                links.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
            }
    const nodes = notes.map(note => { const p = positions.get(note.id); return `<g data-note-id="${note.id}"><circle cx="${p.x}" cy="${p.y}" r="11"/><text x="${p.x}" y="${p.y + 25}">${escapeHtml(note.title.slice(0, 14))}</text></g>`; }).join('');
    openModal('Graphe du second cerveau', `<div class="note-graph"><svg viewBox="0 0 ${size} ${size}">${links.join('')}${nodes}</svg></div><p class="modal-intro">Les traits représentent les liens [[Note]]. Touche une bulle pour ouvrir la note.</p>`, () => { }, 'Fermer');
    root.querySelectorAll('[data-note-id]').forEach(node => node.addEventListener('click', () => { const note = state.notes.find(item => item.id === node.dataset.noteId); if (note)
        openNoteModal(note); }));
}
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
} return (crc ^ 0xffffffff) >>> 0; }
function zipMarkdown(files) {
    const encoder = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const u16 = (value) => new Uint8Array([value & 255, (value >> 8) & 255]);
    const u32 = (value) => new Uint8Array([value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >>> 24) & 255]);
    for (const file of files) {
        const name = encoder.encode(file.name), data = encoder.encode(file.content), crc = crc32(data);
        const local = new Blob([new Uint8Array([0x50, 0x4b, 3, 4]), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
        parts.push(local);
        central.push(new Blob([new Uint8Array([0x50, 0x4b, 1, 2]), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
        offset += local.size;
    }
    const centralBlob = new Blob(central);
    return new Blob([...parts, centralBlob, new Uint8Array([0x50, 0x4b, 5, 6]), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralBlob.size), u32(offset), u16(0)], { type: 'application/zip' });
}
function exportMarkdown() {
    const used = new Set();
    const files = active(state.notes).map(note => { let base = note.title.replace(/[\\/:*?"<>|#[\]]/g, '').trim().slice(0, 80) || 'note'; let name = base; let n = 2; while (used.has(name))
        name = `${base} ${n++}`; used.add(name); const header = `---\ntags: [${note.tags.join(', ')}]\ncreated: ${note.createdAt.slice(0, 10)}\n---\n\n`; return { name: `${name}.md`, content: header + note.body }; });
    if (!files.length) {
        alert('Aucune note à exporter.');
        return;
    }
    download(zipMarkdown(files), 'quotidien-notes-obsidian.zip');
}
function usePreset(index) {
    const preset = PRESET_PROGRAMS[index];
    if (!preset)
        return;
    const form = root.querySelector('#session-form');
    if (!form)
        return;
    form.elements.namedItem('type').value = preset.type;
    form.elements.namedItem('duration').value = String(preset.duration);
    form.elements.namedItem('notes').value = `${preset.name}\n${preset.exercises.map(ex => `${ex.name} ${ex.sets}×${ex.reps}${ex.weight ? ` @ ${ex.weight} kg` : ''}`).join('\n')}`;
    form.elements.namedItem('exercises').value = JSON.stringify(preset.exercises.map(ex => ({ ...ex, id: uid() })));
    form.scrollIntoView({ behavior: 'smooth' });
}
async function installApp() {
    if (deferredInstall) {
        await deferredInstall.prompt();
        await deferredInstall.userChoice;
        deferredInstall = null;
        return;
    }
    alert(/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'Dans Safari, touche Partager puis « Sur l’écran d’accueil ».' : 'Ouvre le menu du navigateur puis choisis « Installer l’application ».');
}
function openSettings() {
    const trash = [
        ...state.tasks.filter(item => item.deletedAt).map(item => ({ type: 'task', id: item.id, label: item.title, deletedAt: item.deletedAt })),
        ...state.events.filter(item => item.deletedAt).map(item => ({ type: 'event', id: item.id, label: item.title, deletedAt: item.deletedAt })),
        ...state.notes.filter(item => item.deletedAt).map(item => ({ type: 'note', id: item.id, label: item.title, deletedAt: item.deletedAt })),
        ...state.habits.filter(item => item.deletedAt).map(item => ({ type: 'habit', id: item.id, label: item.name, deletedAt: item.deletedAt })),
        ...state.routines.filter(item => item.deletedAt).map(item => ({ type: 'routine', id: item.id, label: item.name, deletedAt: item.deletedAt })),
        ...state.programs.filter(item => item.deletedAt).map(item => ({ type: 'program', id: item.id, label: item.name, deletedAt: item.deletedAt })),
        ...state.sessions.filter(item => item.deletedAt).map(item => ({ type: 'session', id: item.id, label: `${item.type} · ${item.date}`, deletedAt: item.deletedAt })),
        ...state.meals.filter(item => item.deletedAt).map(item => ({ type: 'meal', id: item.id, label: item.description, deletedAt: item.deletedAt }))
    ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    openModal('Réglages', `<div class="settings">
    <label>Apparence<select name="theme"><option value="system" ${state.preferences.theme === 'system' ? 'selected' : ''}>Système</option><option value="light" ${state.preferences.theme === 'light' ? 'selected' : ''}>Clair</option><option value="dark" ${state.preferences.theme === 'dark' ? 'selected' : ''}>Sombre</option></select></label>
    <div class="setting-row"><div><strong>Installer l’application</strong><p>Plein écran, hors connexion et raccourci sur l’accueil.</p></div><button type="button" class="mini-btn" data-action="install-app">Installer</button></div>
    <div class="setting-row"><div><strong>Notifications</strong><p>Rappels locaux et rattrapage à la réouverture.</p></div><button type="button" class="mini-btn" data-action="enable-notifications">${state.preferences.notificationsEnabled ? 'Activées' : 'Activer'}</button></div>
    <label>Rappel événement par défaut<select name="eventReminder"><option value="" ${state.preferences.defaultEventReminderMinutes === null ? 'selected' : ''}>Aucun</option>${[[0, "À l’heure"], [10, '10 min avant'], [30, '30 min avant'], [60, '1 h avant'], [1440, '1 jour avant']].map(([value, label]) => `<option value="${value}" ${state.preferences.defaultEventReminderMinutes === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label>Heure par défaut des tâches<input name="taskTime" type="time" value="${state.preferences.defaultTaskReminderTime}"></label>
    <label>Résumé du matin<input name="morning" type="time" value="${state.preferences.morningSummaryTime}"></label>
    <label>Bilan du soir<input name="evening" type="time" value="${state.preferences.eveningReviewTime}"></label>
    <label>Objectif de séances<input name="objective" type="number" min="1" value="${state.preferences.objectiveSessions}"></label>
    <label class="checkbox"><input name="rollover" type="checkbox" ${state.preferences.autoRollOverdue ? 'checked' : ''}> Reporter à aujourd’hui les tâches en retard au changement de jour</label>
    <div class="setting-row"><div><strong>Protection par code</strong><p>Verrou visuel, pas un chiffrement.</p></div><button type="button" class="mini-btn" data-action="set-pin">Définir</button>${state.preferences.pinHash ? '<button type="button" class="mini-btn" data-action="clear-pin">Supprimer</button>' : ''}</div>
    <div class="setting-row"><div><strong>Sauvegarde</strong><p>Export JSON complet et réimportable.</p></div><button type="button" class="mini-btn" data-action="export-data">Exporter</button><button type="button" class="mini-btn" data-action="import-data">Importer</button></div>
    <section class="trash-section"><div class="setting-row"><div><strong>Corbeille — 30 jours</strong><p>${trash.length} élément(s) supprimé(s).</p></div><button type="button" class="mini-btn" data-action="purge-trash">Nettoyer</button></div>${trash.length ? `<div class="trash-list">${trash.slice(0, 30).map(item => `<div class="trash-item"><span>${escapeHtml(item.label)}</span><button type="button" class="mini-btn" data-action="restore-item" data-type="${item.type}" data-id="${item.id}">Restaurer</button></div>`).join('')}</div>` : ''}</section>
    <div class="sync-box"><strong>Mode ${state.preferences.mode === 'local' ? 'local' : 'synchronisé'}</strong><p>IndexedDB est la base locale. Le backend Cloudflare est prêt à recevoir la synchronisation facultative.</p></div>
  </div>`, async (form) => {
        const data = new FormData(form);
        const next = store.snapshot;
        next.preferences.theme = String(data.get('theme'));
        next.preferences.defaultEventReminderMinutes = data.get('eventReminder') === '' ? null : Number(data.get('eventReminder'));
        next.preferences.defaultTaskReminderTime = String(data.get('taskTime') || '09:00');
        next.preferences.morningSummaryTime = String(data.get('morning') || '07:30');
        next.preferences.eveningReviewTime = String(data.get('evening') || '21:30');
        next.preferences.objectiveSessions = Number(data.get('objective')) || 3;
        next.preferences.autoRollOverdue = data.get('rollover') === 'on';
        await store.replace(next);
    });
}
function openSearch() { openModal('Recherche globale', `<div class="search-field"><span>⌕</span><input id="global-search" placeholder="Tâches, notes, événements, séances…" autofocus></div><div id="search-results"></div>`, () => { }, 'Fermer'); const input = root.querySelector('#global-search'); input.addEventListener('input', () => renderSearchResults(input.value)); setTimeout(() => input.focus(), 50); }
function renderSearchResults(query) { const q = query.trim().toLowerCase(); const box = root.querySelector('#search-results'); if (!box)
    return; if (q.length < 2) {
    box.innerHTML = '';
    return;
} const results = []; active(state.tasks).filter(item => item.title.toLowerCase().includes(q)).forEach(item => results.push({ type: 'Tâche', title: item.title, detail: item.dueDate ?? '' })); active(state.notes).filter(item => `${item.title} ${item.body}`.toLowerCase().includes(q)).forEach(item => results.push({ type: 'Note', title: item.title, detail: item.body.slice(0, 80) })); active(state.events).filter(item => `${item.title} ${item.location}`.toLowerCase().includes(q)).forEach(item => results.push({ type: 'Événement', title: item.title, detail: item.date })); active(state.sessions).filter(item => `${item.type} ${item.notes}`.toLowerCase().includes(q)).forEach(item => results.push({ type: 'Séance', title: item.type, detail: item.date })); box.innerHTML = results.length ? results.slice(0, 30).map(item => `<div class="search-result"><span>${item.type}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>`).join('') : empty('Aucun résultat.'); }
function startFocus(id) {
    focusTaskId = id;
    const task = state.tasks.find(item => item.id === id);
    focusSeconds = Math.max(1, task?.estimatedMinutes || 25) * 60;
    focusElapsed = 0;
    const taskTitle = task?.title ?? 'Tâche';
    openModal('Mode concentration', `<div class="focus"><strong id="focus-time">${formatClock(focusSeconds)}</strong><p>${escapeHtml(taskTitle)}</p><button type="button" class="btn" id="focus-toggle">Démarrer</button><button type="button" class="btn ghost" id="focus-save">Enregistrer et fermer</button><button type="button" class="btn ghost" id="focus-done">Terminer la tâche</button></div>`, () => { }, 'Fermer');
    const toggle = root.querySelector('#focus-toggle');
    toggle.addEventListener('click', () => {
        if (focusTimer) {
            clearInterval(focusTimer);
            focusTimer = null;
            toggle.textContent = 'Reprendre';
        }
        else {
            toggle.textContent = 'Pause';
            focusTimer = window.setInterval(() => { focusSeconds = Math.max(0, focusSeconds - 1); focusElapsed += 1; const display = root.querySelector('#focus-time'); if (display)
                display.textContent = formatClock(focusSeconds); if (focusSeconds === 0 && focusTimer) {
                clearInterval(focusTimer);
                focusTimer = null;
                void store.addFocusSession(focusTaskId, taskTitle, Math.max(1, Math.round(focusElapsed / 60)));
                void notify('Session terminée', 'Bravo, prends une courte pause.');
            } }, 1000);
        }
    });
    root.querySelector('#focus-save').addEventListener('click', async () => { if (focusTimer)
        clearInterval(focusTimer); focusTimer = null; if (focusElapsed >= 30)
        await store.addFocusSession(focusTaskId, taskTitle, Math.max(1, Math.round(focusElapsed / 60))); closeModal(); });
    root.querySelector('#focus-done').addEventListener('click', async () => { if (focusTimer)
        clearInterval(focusTimer); focusTimer = null; if (focusElapsed >= 30)
        await store.addFocusSession(focusTaskId, taskTitle, Math.max(1, Math.round(focusElapsed / 60))); if (focusTaskId)
        await store.toggleTask(focusTaskId); closeModal(); });
}
function toggleInterval() { if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
    render();
    return;
} if (!intervalState) {
    const effort = Number(root.querySelector('#interval-effort')?.value || 30);
    const rest = Number(root.querySelector('#interval-rest')?.value || 30);
    const rounds = Number(root.querySelector('#interval-rounds')?.value || 8);
    intervalState = { phase: 'effort', remaining: effort, round: 1, rounds, effort, rest };
} intervalTimer = window.setInterval(() => { if (!intervalState)
    return; intervalState.remaining -= 1; if (intervalState.remaining <= 0) {
    if (intervalState.phase === 'effort' && intervalState.rest > 0) {
        intervalState.phase = 'rest';
        intervalState.remaining = intervalState.rest;
        beep(440);
    }
    else if (intervalState.round >= intervalState.rounds) {
        resetInterval();
        notify('Entraînement terminé', 'Tous les intervalles sont terminés.');
        return;
    }
    else {
        intervalState.round += 1;
        intervalState.phase = 'effort';
        intervalState.remaining = intervalState.effort;
        beep(880);
    }
} const time = root.querySelector('#interval-time'); if (time)
    time.textContent = formatClock(intervalState.remaining); const phase = root.querySelector('#interval-phase'); if (phase)
    phase.textContent = intervalState.phase === 'effort' ? 'EFFORT' : 'REPOS'; }, 1000); render(); }
function resetInterval() { if (intervalTimer)
    clearInterval(intervalTimer); intervalTimer = null; intervalState = null; render(); }
function beep(frequency) { try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .15);
}
catch { } }
function useProgram(id) { const program = state.programs.find(item => item.id === id); if (!program)
    return; const form = root.querySelector('#session-form'); if (!form)
    return; form.elements.namedItem('type').value = 'Musculation'; form.elements.namedItem('duration').value = form.elements.namedItem('duration').value || '45'; form.elements.namedItem('notes').value = `${program.name}\n${program.exercises.map(ex => `${ex.name} ${ex.sets}×${ex.reps}${ex.weight ? ` @ ${ex.weight} kg` : ''}`).join('\n')}`; form.elements.namedItem('exercises').value = JSON.stringify(program.exercises); form.scrollIntoView({ behavior: 'smooth' }); }
function icsEscape(value) { return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function eventIcs(event) { const date = event.date.replaceAll('-', ''); const time = event.time?.replace(':', '') ?? ''; const start = event.time ? `DTSTART:${date}T${time}00` : `DTSTART;VALUE=DATE:${date}`; const lines = ['BEGIN:VEVENT', `UID:${event.id}@quotidien`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, start, `SUMMARY:${icsEscape(event.title)}`]; if (event.durationMinutes && event.time)
    lines.push(`DURATION:PT${event.durationMinutes}M`); if (event.location)
    lines.push(`LOCATION:${icsEscape(event.location)}`); if (event.notes)
    lines.push(`DESCRIPTION:${icsEscape(event.notes)}`); if (event.recurrence)
    lines.push(`RRULE:FREQ=${event.recurrence === 'daily' ? 'DAILY' : event.recurrence === 'weekly' ? 'WEEKLY' : 'MONTHLY'}`); if (event.reminderMinutes !== null)
    lines.push('BEGIN:VALARM', `TRIGGER:-PT${event.reminderMinutes}M`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(event.title)}`, 'END:VALARM'); lines.push('END:VEVENT'); return lines.join('\r\n'); }
function exportIcs() { const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quotidien V6//FR', ...active(state.events).map(eventIcs), 'END:VCALENDAR'].join('\r\n'); download(new Blob([content], { type: 'text/calendar' }), `quotidien-agenda-${today()}.ics`); }
function shareEvent(event) { const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quotidien V6//FR', eventIcs(event), 'END:VCALENDAR'].join('\r\n'); const file = new File([content], `${event.title.replace(/[^a-z0-9]/gi, '-')}.ics`, { type: 'text/calendar' }); if (navigator.canShare?.({ files: [file] }))
    void navigator.share({ files: [file], title: event.title });
else
    download(file, file.name); }
function importIcs() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.ics,text/calendar'; input.onchange = async () => { const file = input.files?.[0]; if (!file)
    return; const text = await file.text(); const blocks = text.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1); const next = store.snapshot; for (const block of blocks) {
    const get = (pattern) => block.match(pattern)?.[1]?.trim() ?? '';
    const title = get(/SUMMARY[^:]*:(.*)/);
    const dt = get(/DTSTART[^:]*:([0-9T]+)/);
    if (!title || dt.length < 8)
        continue;
    const date = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    const time = dt.includes('T') ? `${dt.slice(9, 11)}:${dt.slice(11, 13)}` : null;
    next.events.push({ ...createImportedMeta(next.deviceId), kind: 'event', title, date, time, durationMinutes: 60, category: 'other', location: get(/LOCATION[^:]*:(.*)/), notes: get(/DESCRIPTION[^:]*:(.*)/), recurrence: '', reminderMinutes: null, countdown: false });
} await store.replace(next); toast(`${blocks.length} événement(s) importé(s)`); }; input.click(); }
function createImportedMeta(deviceId) { const stamp = new Date().toISOString(); return { id: uid(), createdAt: stamp, updatedAt: stamp, deletedAt: null, revision: 1, deviceId, syncStatus: 'local' }; }
function exportData() { const snapshot = store.snapshot; snapshot.preferences.lastExportAt = new Date().toISOString(); download(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }), `quotidien-v6-${today()}.json`); void store.setPreference('lastExportAt', snapshot.preferences.lastExportAt); }
function importData() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = async () => { const file = input.files?.[0]; if (!file)
    return; try {
    const parsed = JSON.parse(await file.text());
    if (parsed.schemaVersion !== 6)
        throw new Error('Version incompatible');
    await store.replace(parsed);
    closeModal();
    toast('Sauvegarde restaurée');
}
catch (error) {
    alert(`Import impossible : ${error instanceof Error ? error.message : 'fichier invalide'}`);
} }; input.click(); }
async function setPin() { const code = prompt('Choisis un code de 4 à 8 chiffres'); if (!code || !/^\d{4,8}$/.test(code)) {
    alert('Le code doit contenir 4 à 8 chiffres.');
    return;
} await store.setPreference('pinHash', await hash(code)); unlocked = true; }
async function hash(value) { const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`quotidien:${value}`)); return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function renderLock() { root.innerHTML = `<main class="lock"><img src="./icon-192.png" alt=""><h1>Quotidien</h1><p>Entre ton code pour continuer.</p><form id="unlock-form"><input name="code" type="password" inputmode="numeric" maxlength="8" autofocus><button class="btn">Déverrouiller</button><span id="unlock-error"></span></form></main>`; root.querySelector('#unlock-form').addEventListener('submit', async (event) => { event.preventDefault(); const code = String(new FormData(event.currentTarget).get('code')); if (await hash(code) === state.preferences.pinHash) {
    unlocked = true;
    render();
}
else
    root.querySelector('#unlock-error').textContent = 'Code incorrect'; }); }
async function enableNotifications() { if (!('Notification' in window)) {
    alert('Les notifications ne sont pas disponibles.');
    return;
} const permission = await Notification.requestPermission(); await store.setPreference('notificationsEnabled', permission === 'granted'); if (permission === 'granted')
    await notify('Rappels activés', 'Quotidien pourra afficher tes rappels lorsque le système l’autorise.'); }
async function notify(title, body, url = './') { if (Notification.permission !== 'granted')
    return; const registration = await navigator.serviceWorker?.ready; if (registration)
    await registration.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', data: { url } });
else
    new Notification(title, { body }); }
async function checkReminders() {
    await refreshDay();
    if (!state?.preferences.notificationsEnabled || Notification.permission !== 'granted')
        return;
    const current = new Date(), date = today(), log = state.notificationLog;
    const due = [];
    for (const event of eventsOn(date)) {
        if (event.reminderMinutes === null)
            continue;
        const at = new Date(`${date}T${event.time ?? '08:00'}:00`), notifyAt = new Date(at.getTime() - event.reminderMinutes * 60000), key = `event:${event.id}:${date}`;
        if (!log[key] && current >= notifyAt && current <= new Date(at.getTime() + 15 * 60000))
            due.push({ key, title: `📅 ${event.title}`, body: event.time ? `${event.time}${event.location ? ` · ${event.location}` : ''}` : 'Aujourd’hui', url: `./?screen=plan&tab=agenda&date=${date}` });
    }
    for (const task of active(state.tasks).filter(item => !item.completed && item.dueDate === date && item.reminderMinutes !== null)) {
        const at = new Date(`${date}T${task.dueTime ?? state.preferences.defaultTaskReminderTime}:00`), notifyAt = new Date(at.getTime() - (task.reminderMinutes ?? 0) * 60000), key = `task:${task.id}:${date}`;
        if (!log[key] && current >= notifyAt && current <= new Date(at.getTime() + 15 * 60000))
            due.push({ key, title: `✓ ${task.title}`, body: 'Tâche prévue aujourd’hui', url: './?screen=plan' });
    }
    const minutes = current.getHours() * 60 + current.getMinutes();
    const toMinutes = (value) => { const parts = value.split(':').map(Number); return (parts[0] ?? 0) * 60 + (parts[1] ?? 0); };
    const morningKey = `summary-am:${date}`;
    if (!log[morningKey] && minutes >= toMinutes(state.preferences.morningSummaryTime)) {
        const tasks = active(state.tasks).filter(item => !item.completed && item.dueDate && item.dueDate <= date).length, events = eventsOn(date).length;
        due.push({ key: morningKey, title: 'Bonjour — ta journée', body: `${events} événement(s) · ${tasks} tâche(s) à traiter`, url: './?screen=today' });
    }
    const eveningKey = `summary-pm:${date}`;
    if (!log[eveningKey] && minutes >= toMinutes(state.preferences.eveningReviewTime)) {
        const done = active(state.tasks).filter(item => item.completedAt?.slice(0, 10) === date).length, sport = active(state.sessions).filter(item => item.date === date).reduce((sum, item) => sum + item.durationMinutes, 0);
        due.push({ key: eveningKey, title: 'Bilan du jour', body: `${done} tâche(s) terminée(s) · ${sport} min de sport`, url: './?screen=today' });
    }
    if (!due.length)
        return;
    const next = store.snapshot;
    for (const item of due) {
        await notify(item.title, item.body, item.url);
        next.notificationLog[item.key] = new Date().toISOString();
    }
    await store.replace(next);
}
function registerServiceWorker() { if ('serviceWorker' in navigator)
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error)); }
function toast(message) { const element = root.querySelector('#toast'); if (!element)
    return; element.textContent = message; element.hidden = false; setTimeout(() => { element.hidden = true; }, 2500); }
//# sourceMappingURL=app.js.map