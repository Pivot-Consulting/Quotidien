import { LIFE_DOMAINS, type LifeDomainId } from './catalog.js';

export type LifeEntryStatus = 'idea' | 'active' | 'waiting' | 'done';

export interface LifeEntry {
  id: string;
  domainId: LifeDomainId;
  title: string;
  details: string;
  tags: string[];
  status: LifeEntryStatus;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeOsState {
  version: 1;
  enabled: Record<LifeDomainId, boolean>;
  entries: LifeEntry[];
  updatedAt: string;
}

const STORAGE_KEY = 'quotidien-v7-life-os';
const STATUS_VALUES: readonly LifeEntryStatus[] = ['idea', 'active', 'waiting', 'done'];
const DOMAIN_IDS = new Set<LifeDomainId>(LIFE_DOMAINS.map(domain => domain.id));

const now = (): string => new Date().toISOString();
const uid = (): string => crypto.randomUUID();
const localDate = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function defaultEnabled(): Record<LifeDomainId, boolean> {
  return Object.fromEntries(LIFE_DOMAINS.map(domain => [domain.id, true])) as Record<LifeDomainId, boolean>;
}

export function emptyLifeOsState(): LifeOsState {
  return { version: 1, enabled: defaultEnabled(), entries: [], updatedAt: now() };
}

function normalizeEntry(value: unknown): LifeEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<LifeEntry>;
  if (!raw.domainId || !DOMAIN_IDS.has(raw.domainId) || typeof raw.title !== 'string' || !raw.title.trim()) return null;
  const status = raw.status && STATUS_VALUES.includes(raw.status) ? raw.status : 'idea';
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : now();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    domainId: raw.domainId,
    title: raw.title.trim(),
    details: typeof raw.details === 'string' ? raw.details : '',
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).map(tag => tag.trim()).filter(Boolean) : [],
    status,
    date: typeof raw.date === 'string' && raw.date ? raw.date : localDate(),
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
  };
}

export function normalizeLifeOsState(value: unknown): LifeOsState {
  const empty = emptyLifeOsState();
  if (!value || typeof value !== 'object') return empty;
  const raw = value as Partial<LifeOsState>;
  const enabled = defaultEnabled();
  if (raw.enabled && typeof raw.enabled === 'object') {
    for (const domain of LIFE_DOMAINS) enabled[domain.id] = raw.enabled[domain.id] !== false;
  }
  return {
    version: 1,
    enabled,
    entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry).filter((entry): entry is LifeEntry => entry !== null) : [],
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now(),
  };
}

export function loadLifeOsState(): LifeOsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeLifeOsState(JSON.parse(raw)) : emptyLifeOsState();
  } catch {
    return emptyLifeOsState();
  }
}

export function saveLifeOsState(state: LifeOsState): LifeOsState {
  const next = normalizeLifeOsState({ ...state, updatedAt: now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function addLifeEntry(state: LifeOsState, input: { domainId: LifeDomainId; title: string; details: string; tags: string[]; status: LifeEntryStatus; date: string }): LifeOsState {
  const stamp = now();
  const entry: LifeEntry = {
    id: uid(), domainId: input.domainId, title: input.title.trim(), details: input.details.trim(),
    tags: input.tags.map(tag => tag.trim()).filter(Boolean), status: input.status, date: input.date || localDate(), createdAt: stamp, updatedAt: stamp,
  };
  if (!entry.title) return state;
  return saveLifeOsState({ ...state, entries: [entry, ...state.entries] });
}

export function updateLifeEntry(state: LifeOsState, id: string, patch: Partial<Pick<LifeEntry, 'title' | 'details' | 'tags' | 'status' | 'date'>>): LifeOsState {
  return saveLifeOsState({ ...state, entries: state.entries.map(entry => entry.id === id ? { ...entry, ...patch, updatedAt: now() } : entry) });
}

export function deleteLifeEntry(state: LifeOsState, id: string): LifeOsState {
  return saveLifeOsState({ ...state, entries: state.entries.filter(entry => entry.id !== id) });
}

export function toggleLifeDomain(state: LifeOsState, domainId: LifeDomainId): LifeOsState {
  return saveLifeOsState({ ...state, enabled: { ...state.enabled, [domainId]: !state.enabled[domainId] } });
}

export function replaceLifeOsState(value: unknown): LifeOsState {
  return saveLifeOsState(normalizeLifeOsState(value));
}

export function exportLifeOsState(state: LifeOsState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `quotidien-life-os-${localDate()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
