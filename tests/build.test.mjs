import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('le manifeste identifie Quotidien Life OS comme PWA installable', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, 'Quotidien Life OS');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 2);
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('capture=goal')));
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('lifeos=1')));
});

test('le service worker précharge le shell V7.1.3', async () => {
  const worker = await readFile('public/sw.js', 'utf8');
  assert.match(worker, /v7\.1\.3/);
  for (const path of ['assets/main.js','assets/mobile-interactions.js','assets/app-v61.js','assets/version-brand.js','assets/normalization.js','assets/life-os/hub.js','assets/wave-a/app.js']) assert.ok(worker.includes(path));
  assert.match(worker, /showNotification/);
});

test('la migration couvre les domaines historiques', async () => {
  const migration = await readFile('src/migration.ts', 'utf8');
  for (const key of ['taches', 'evenements', 'notes', 'habitudes', 'routines', 'programmesPerso', 'seances', 'poids', 'sommeil', 'repas', 'mesures', 'eau']) assert.ok(migration.includes(key), `migration manquante pour ${key}`);
});

test('le modèle V6.1 reste présent sous le hub V7', async () => {
  const types = await readFile('src/types.ts', 'utf8');
  const store = await readFile('src/store.ts', 'utf8');
  const app = await readFile('src/app-v61.ts', 'utf8');
  for (const entity of ['Goal', 'TimeBlock', 'MoodEntry']) assert.ok(types.includes(`interface ${entity}`));
  for (const method of ['addGoal', 'addTimeBlock', 'addMood', 'markNotification']) assert.ok(store.includes(method));
  for (const feature of ['renderAnalytics', 'openSearch', 'openFocus', 'handleInitialUrl']) assert.ok(app.includes(feature));
});
