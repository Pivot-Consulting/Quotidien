import { LIFE_DOMAINS, LIFE_DOMAIN_BY_ID, LIFE_GROUP_LABELS, type LifeDomainGroup, type LifeDomainId } from './catalog.js';
import { addLifeEntry, deleteLifeEntry, exportLifeOsState, loadLifeOsState, replaceLifeOsState, toggleLifeDomain, updateLifeEntry, type LifeEntryStatus, type LifeOsState } from './store.js';

const STATUS_LABELS: Record<LifeEntryStatus, string> = { idea: 'Idée', active: 'En cours', waiting: 'En attente', done: 'Terminé' };
const GROUPS: readonly LifeDomainGroup[] = ['organiser', 'se-developper', 'prendre-soin', 'piloter'];
const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character] ?? character);
const today = (): string => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };

let state: LifeOsState = loadLifeOsState();
let activeDomain: LifeDomainId | null = null;
let search = '';

const launcher = document.createElement('button');
launcher.className = 'life-os-launcher';
launcher.type = 'button';
launcher.setAttribute('aria-label', 'Ouvrir les espaces de vie');
launcher.innerHTML = '<span>✦</span><small>20 espaces</small>';

const overlay = document.createElement('div');
overlay.className = 'life-os-overlay';
overlay.hidden = true;
overlay.innerHTML = '<section class="life-os-panel" role="dialog" aria-modal="true" aria-label="Quotidien Life OS"><div id="life-os-content"></div></section>';
document.body.append(launcher, overlay);

launcher.addEventListener('click', openHub);
overlay.addEventListener('click', event => void handleClick(event));
overlay.addEventListener('submit', event => void handleSubmit(event));
overlay.addEventListener('input', handleInput);
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); openHub(); }
  if (event.key === 'Escape' && !overlay.hidden) closeHub();
});

if (new URLSearchParams(location.search).get('lifeos') === '1') queueMicrotask(openHub);

function openHub(): void {
  overlay.hidden = false;
  document.body.classList.add('life-os-open');
  render();
}

function closeHub(): void {
  overlay.hidden = true;
  document.body.classList.remove('life-os-open');
}

function render(): void {
  const content = overlay.querySelector<HTMLElement>('#life-os-content');
  if (!content) return;
  content.innerHTML = activeDomain ? renderDomain(activeDomain) : renderHome();
}

function renderHome(): string {
  const entries = state.entries.filter(entry => matches(entry.title, entry.details, entry.tags.join(' ')));
  const enabledCount = LIFE_DOMAINS.filter(domain => state.enabled[domain.id]).length;
  const doneCount = state.entries.filter(entry => entry.status === 'done').length;
  return `<header class="life-os-header">
    <div><span class="life-os-eyebrow">QUOTIDIEN V7</span><h1>Mon système de vie</h1><p>Les 20 grandes thématiques sont lancées dans un socle commun, local-first et progressivement spécialisable.</p></div>
    <button type="button" class="life-os-close" data-life-action="close" aria-label="Fermer">×</button>
  </header>
  <section class="life-os-summary">
    <article><strong>20</strong><span>espaces disponibles</span></article><article><strong>${enabledCount}</strong><span>espaces actifs</span></article><article><strong>${state.entries.length}</strong><span>éléments capturés</span></article><article><strong>${doneCount}</strong><span>éléments terminés</span></article>
  </section>
  <section class="life-os-toolbar">
    <label><span>⌕</span><input id="life-os-search" value="${escapeHtml(search)}" placeholder="Rechercher dans tous les espaces…"></label>
    <button type="button" data-life-action="export">Exporter</button><button type="button" data-life-action="import">Importer</button>
  </section>
  ${GROUPS.map(group => renderGroup(group, entries)).join('')}`;
}

function renderGroup(group: LifeDomainGroup, filteredEntries: LifeOsState['entries']): string {
  const domains = LIFE_DOMAINS.filter(domain => domain.group === group);
  return `<section class="life-os-group"><header><h2>${LIFE_GROUP_LABELS[group]}</h2><span>${domains.length} espaces</span></header><div class="life-os-grid">${domains.map(domain => {
    const count = filteredEntries.filter(entry => entry.domainId === domain.id).length;
    const enabled = state.enabled[domain.id];
    return `<article class="life-domain-card ${enabled ? '' : 'disabled'}">
      <div class="life-domain-icon">${escapeHtml(domain.icon)}</div><div class="life-domain-copy"><h3>${escapeHtml(domain.label)}</h3><p>${escapeHtml(domain.description)}</p><div class="life-domain-outcomes">${domain.outcomes.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div></div>
      <footer><span>${count} élément${count > 1 ? 's' : ''}</span><div><button type="button" data-life-action="toggle-domain" data-domain="${domain.id}">${enabled ? 'Masquer' : 'Activer'}</button><button type="button" class="primary" data-life-action="open-domain" data-domain="${domain.id}">Ouvrir</button></div></footer>
    </article>`;
  }).join('')}</div></section>`;
}

function renderDomain(domainId: LifeDomainId): string {
  const domain = LIFE_DOMAIN_BY_ID.get(domainId);
  if (!domain) { activeDomain = null; return renderHome(); }
  const entries = state.entries.filter(entry => entry.domainId === domainId && matches(entry.title, entry.details, entry.tags.join(' ')));
  return `<header class="life-os-header domain">
    <button type="button" class="life-os-back" data-life-action="back">‹ Tous les espaces</button>
    <div><span class="life-os-eyebrow">${escapeHtml(LIFE_GROUP_LABELS[domain.group])}</span><h1>${escapeHtml(domain.icon)} ${escapeHtml(domain.label)}</h1><p>${escapeHtml(domain.description)}</p></div>
    <button type="button" class="life-os-close" data-life-action="close" aria-label="Fermer">×</button>
  </header>
  <section class="life-domain-starters"><strong>Points de départ</strong>${domain.starters.map(starter => `<button type="button" data-life-action="starter" data-title="${escapeHtml(starter)}">＋ ${escapeHtml(starter)}</button>`).join('')}</section>
  <section class="life-domain-workspace">
    <form id="life-entry-form" class="life-entry-form">
      <input name="title" id="life-entry-title" placeholder="Nouvel élément dans ${escapeHtml(domain.label)}…" required>
      <textarea name="details" placeholder="Notes, contexte, prochaine étape…"></textarea>
      <div class="life-entry-fields"><input name="tags" placeholder="Tags séparés par des virgules"><select name="status">${statusOptions('active')}</select><input name="date" type="date" value="${today()}"></div>
      <button type="submit">Ajouter</button>
    </form>
    <div class="life-domain-list-head"><label><span>⌕</span><input id="life-os-search" value="${escapeHtml(search)}" placeholder="Filtrer cet espace…"></label><span>${entries.length} élément${entries.length > 1 ? 's' : ''}</span></div>
    <div class="life-entry-list">${entries.length ? entries.map(renderEntry).join('') : `<div class="life-os-empty"><strong>Cet espace est prêt.</strong><p>Ajoute un premier élément ou utilise l’un des points de départ.</p></div>`}</div>
  </section>`;
}

function renderEntry(entry: LifeOsState['entries'][number]): string {
  return `<article class="life-entry ${entry.status}"><header><div><strong>${escapeHtml(entry.title)}</strong><time>${escapeHtml(new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${entry.date}T12:00:00`)))}</time></div><button type="button" data-life-action="delete-entry" data-id="${entry.id}" aria-label="Supprimer">×</button></header>${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ''}${entry.tags.length ? `<div class="life-entry-tags">${entry.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}<footer><select data-life-action="entry-status" data-id="${entry.id}">${statusOptions(entry.status)}</select><span>Mis à jour ${escapeHtml(new Intl.RelativeTimeFormat('fr',{numeric:'auto'}).format(Math.round((new Date(entry.updatedAt).getTime()-Date.now())/86400000),'day'))}</span></footer></article>`;
}

function statusOptions(selected: LifeEntryStatus): string {
  return (Object.entries(STATUS_LABELS) as Array<[LifeEntryStatus,string]>).map(([value,label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function matches(...values: string[]): boolean {
  const query = search.trim().toLowerCase();
  return !query || values.join(' ').toLowerCase().includes(query);
}

function domainFrom(element: HTMLElement): LifeDomainId | null {
  const value = element.dataset.domain as LifeDomainId | undefined;
  return value && LIFE_DOMAIN_BY_ID.has(value) ? value : null;
}

async function handleClick(event: Event): Promise<void> {
  if (event.target === overlay) return closeHub();
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-life-action]');
  if (!target) return;
  const action = target.dataset.lifeAction;
  if (action === 'close') return closeHub();
  if (action === 'back') { activeDomain = null; search = ''; return render(); }
  if (action === 'open-domain') { const domain = domainFrom(target); if (domain) { activeDomain = domain; search = ''; render(); } return; }
  if (action === 'toggle-domain') { const domain = domainFrom(target); if (domain) { state = toggleLifeDomain(state, domain); render(); } return; }
  if (action === 'starter') { const input = overlay.querySelector<HTMLInputElement>('#life-entry-title'); if (input) { input.value = target.dataset.title ?? ''; input.focus(); } return; }
  if (action === 'delete-entry') { const id = target.dataset.id; if (id && confirm('Supprimer cet élément ?')) { state = deleteLifeEntry(state, id); render(); } return; }
  if (action === 'export') { exportLifeOsState(state); return; }
  if (action === 'import') return importState();
}

async function handleSubmit(event: Event): Promise<void> {
  const form = event.target as HTMLFormElement;
  if (form.id !== 'life-entry-form' || !activeDomain) return;
  event.preventDefault();
  const data = new FormData(form);
  const rawStatus = String(data.get('status') ?? 'active') as LifeEntryStatus;
  const status: LifeEntryStatus = Object.hasOwn(STATUS_LABELS, rawStatus) ? rawStatus : 'active';
  state = addLifeEntry(state, {
    domainId: activeDomain,
    title: String(data.get('title') ?? ''),
    details: String(data.get('details') ?? ''),
    tags: String(data.get('tags') ?? '').split(','),
    status,
    date: String(data.get('date') ?? today()),
  });
  form.reset();
  render();
}

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.id === 'life-os-search') { search = target.value; render(); const input = overlay.querySelector<HTMLInputElement>('#life-os-search'); input?.focus(); input?.setSelectionRange(search.length, search.length); return; }
  if (target.dataset.lifeAction === 'entry-status') {
    const id = target.dataset.id;
    const status = target.value as LifeEntryStatus;
    if (id && Object.hasOwn(STATUS_LABELS, status)) { state = updateLifeEntry(state, id, { status }); render(); }
  }
}

function importState(): void {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    try { state = replaceLifeOsState(JSON.parse(await file.text())); activeDomain = null; search = ''; render(); }
    catch { alert('Le fichier sélectionné ne contient pas une sauvegarde Life OS valide.'); }
  });
  input.click();
}
