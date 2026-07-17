import type { ISODate, Meta, Recurrence, WeekDay } from './types.js';

export const uid = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();
export const today = (): ISODate => localDate(new Date());
export const localDate = (date: Date): ISODate => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const parseDate = (iso: ISODate): Date => { const [y = 0, m = 1, d = 1] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const shiftDate = (iso: ISODate, days: number): ISODate => { const date = parseDate(iso); date.setDate(date.getDate() + days); return localDate(date); };
export const mondayOf = (iso: ISODate): ISODate => shiftDate(iso, -((parseDate(iso).getDay() + 6) % 7));
export const weekday = (iso: ISODate): WeekDay => parseDate(iso).getDay() as WeekDay;
export const formatDate = (iso: ISODate, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string => new Intl.DateTimeFormat('fr-FR', options).format(parseDate(iso));
export const formatDuration = (minutes: number): string => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}`.trim() : `${minutes} min`;
export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
export const meta = (deviceId: string): Meta => ({ id: uid(), createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null, revision: 1, deviceId, syncStatus: 'local' });
export const touch = <T extends Meta>(entity: T): T => ({ ...entity, updatedAt: nowIso(), revision: entity.revision + 1, syncStatus: 'pending' });

export function occursOn(startDate: ISODate, recurrence: Recurrence, date: ISODate): boolean {
  if (date < startDate) return false;
  if (!recurrence) return date === startDate;
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekly') return weekday(date) === weekday(startDate);
  return date.slice(8) === startDate.slice(8);
}

export function nextRecurrence(date: ISODate, recurrence: Recurrence): ISODate {
  if (recurrence === 'daily') return shiftDate(date, 1);
  if (recurrence === 'weekly') return shiftDate(date, 7);
  if (recurrence === 'monthly') {
    const next = parseDate(date); next.setMonth(next.getMonth() + 1); return localDate(next);
  }
  return date;
}

export const active = <T extends Meta>(items: T[]): T[] => items.filter(item => !item.deletedAt);
export const download = (blob: Blob, filename: string): void => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

export function markdown(text: string): string {
  const inline = (line: string) => escapeHtml(line)
    .replace(/\[\[([^\]]+)\]\]/g, '<button class="wiki-link" data-note-title="$1">$1</button>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  return text.split('\n').map(line => {
    if (line.startsWith('## ')) return `<h4>${inline(line.slice(3))}</h4>`;
    if (line.startsWith('# ')) return `<h3>${inline(line.slice(2))}</h3>`;
    if (/^[-*] /.test(line)) return `<div class="md-list">• ${inline(line.slice(2))}</div>`;
    if (/^- \[[ x]\] /.test(line)) return `<div class="md-list">${line[3] === 'x' ? '☑' : '☐'} ${inline(line.slice(6))}</div>`;
    return line.trim() ? `<p>${inline(line)}</p>` : '<div class="md-gap"></div>';
  }).join('');
}
