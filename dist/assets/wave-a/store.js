const KEY = 'quotidien-v7-wave-a';
const now = () => new Date().toISOString();
export const labels = { project: 'Projets de vie', transaction: 'Finances', document: 'Documents', asset: 'Maison', automation: 'Automatisations' };
export function loadWaveA() { try {
    const raw = localStorage.getItem(KEY);
    if (!raw)
        return { version: 1, items: [] };
    const parsed = JSON.parse(raw);
    return { version: 1, items: Array.isArray(parsed.items) ? parsed.items.filter(Boolean) : [] };
}
catch {
    return { version: 1, items: [] };
} }
export function saveWaveA(state) { localStorage.setItem(KEY, JSON.stringify(state)); return state; }
export function addWaveA(state, input) { const item = { ...input, id: crypto.randomUUID(), createdAt: now() }; return saveWaveA({ ...state, items: [item, ...state.items] }); }
export function removeWaveA(state, id) { return saveWaveA({ ...state, items: state.items.filter(item => item.id !== id) }); }
export function updateWaveA(state, id, patch) { return saveWaveA({ ...state, items: state.items.map(item => item.id === id ? { ...item, ...patch } : item) }); }
export function totals(state) { const tx = state.items.filter(i => i.type === 'transaction'); const income = tx.filter(i => i.amount && i.amount > 0).reduce((s, i) => s + (i.amount ?? 0), 0); const expenses = Math.abs(tx.filter(i => i.amount && i.amount < 0).reduce((s, i) => s + (i.amount ?? 0), 0)); const projects = state.items.filter(i => i.type === 'project'); const avg = projects.length ? Math.round(projects.reduce((s, i) => s + (i.progress ?? 0), 0) / projects.length) : 0; return { income, expenses, balance: income - expenses, avg, projects: projects.length, documents: state.items.filter(i => i.type === 'document').length, assets: state.items.filter(i => i.type === 'asset').length, automations: state.items.filter(i => i.type === 'automation').length }; }
//# sourceMappingURL=store.js.map