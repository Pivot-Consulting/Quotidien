import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('le manifeste identifie la V6 installable', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, 'Quotidien');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 2);
});

test('le service worker précharge le shell', async () => {
  const worker = await readFile('public/sw.js', 'utf8');
  assert.match(worker, /v6\.0\.0/);
  assert.match(worker, /assets\/main\.js/);
  assert.match(worker, /showNotification/);
});

test('la migration couvre les domaines historiques', async () => {
  const migration = await readFile('src/migration.ts', 'utf8');
  for (const key of ['taches', 'evenements', 'notes', 'habitudes', 'routines', 'programmesPerso', 'seances', 'poids', 'sommeil', 'repas', 'mesures', 'eau']) {
    assert.ok(migration.includes(key), `migration manquante pour ${key}`);
  }
});
