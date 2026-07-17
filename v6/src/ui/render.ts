import type { AppSnapshot } from '../domain/types';
import type { AppStore } from '../app/store';

export function mountApp(root: HTMLElement, store: AppStore): void {
  root.innerHTML = `
    <header class="topbar"><div><span class="eyebrow">QUOTIDIEN V6</span><h1>Bonjour Raphaël</h1></div><button id="theme" class="icon-button" aria-label="Changer le thème">◐</button></header>
    <main class="content">
      <section class="hero"><p id="date"></p><h2>Que veux-tu faire avancer aujourd’hui ?</h2><form id="quick-task" class="quick"><input name="title" autocomplete="off" placeholder="Ajouter une tâche…"><button>Ajouter</button></form></section>
      <section class="card"><div class="section-title"><h2>Aujourd’hui</h2><span id="task-count" class="badge"></span></div><div id="tasks"></div></section>
      <section class="card"><div class="section-title"><h2>Notes rapides</h2></div><form id="quick-note" class="note-form"><input name="title" placeholder="Titre"><textarea name="body" placeholder="Écris sans te censurer…"></textarea><button>Enregistrer</button></form><div id="notes"></div></section>
      <section class="card sync-card"><div><strong>Mode local-first</strong><p>Les données sont conservées sur cet appareil et fonctionnent hors connexion.</p></div><span class="status">Prêt pour la synchronisation</span></section>
    </main>
    <nav class="bottom-nav"><button class="active">Aujourd’hui</button><button>Tâches</button><button class="add" aria-label="Ajouter">＋</button><button>Notes</button><button>Réglages</button></nav>`;

  const taskForm = root.querySelector<HTMLFormElement>('#quick-task')!;
  const noteForm = root.querySelector<HTMLFormElement>('#quick-note')!;
  const theme = root.querySelector<HTMLButtonElement>('#theme')!;
  root.querySelector<HTMLElement>('#date')!.textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  taskForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(taskForm);
    await store.addTask(String(data.get('title') || ''));
    taskForm.reset();
  });

  noteForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(noteForm);
    await store.addNote(String(data.get('title') || ''), String(data.get('body') || ''));
    noteForm.reset();
  });

  theme.addEventListener('click', () => document.documentElement.classList.toggle('dark'));

  store.subscribe(state => renderState(root, state, store));
}

function renderState(root: HTMLElement, state: AppSnapshot, store: AppStore): void {
  const openTasks = state.tasks.filter(task => !task.completed && !task.deletedAt);
  root.querySelector<HTMLElement>('#task-count')!.textContent = `${openTasks.length} à faire`;
  root.querySelector<HTMLElement>('#tasks')!.innerHTML = openTasks.length
    ? openTasks.map(task => `<button class="task" data-id="${task.id}"><span class="check"></span><span>${escapeHtml(task.title)}</span></button>`).join('')
    : '<p class="empty">Aucune tâche urgente. Profite de cet espace.</p>';

  root.querySelectorAll<HTMLButtonElement>('.task').forEach(button => {
    button.addEventListener('click', () => store.toggleTask(button.dataset.id!));
  });

  root.querySelector<HTMLElement>('#notes')!.innerHTML = state.notes.slice(0, 3).map(note => `
    <article class="note"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.body).slice(0, 180)}</p></article>`).join('');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}
