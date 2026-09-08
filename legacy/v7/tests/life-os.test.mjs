import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const EXPECTED_IDS = [
  'finances','projets-vie','apprentissage','documents','maison','nutrition','sante-avancee','relations','voyages','carriere',
  'decisions','journal','automatisations','assistant','vie-numerique','securite','impact','foyer','gamification','equilibre',
];

test('le catalogue V7 lance exactement les 20 thématiques', async () => {
  const catalog = await readFile('src/life-os/catalog.ts', 'utf8');
  for (const id of EXPECTED_IDS) assert.match(catalog, new RegExp(`id:'${id}'`), `thématique absente : ${id}`);
  assert.equal(new Set(EXPECTED_IDS).size, 20);
});

test('le point d’entrée charge l’application, la marque et les modules', async () => {
  const main = await readFile('src/main.ts', 'utf8');
  for (const token of ['app-v61.js','life-os/hub.js','wave-a/app.js','version-brand.js']) assert.ok(main.includes(token));
  assert.ok(!main.includes('mobile-interactions.js'));
});

test('la vague A couvre les cinq outils métier', async () => {
  const store = await readFile('src/wave-a/store.ts', 'utf8');
  const app = await readFile('src/wave-a/app.ts', 'utf8');
  for (const type of ['project','transaction','document','asset','automation']) assert.ok(store.includes(`'${type}'`));
  for (const label of ['Projets de vie','Finances','Documents','Maison','Automatisations']) assert.ok(app.includes(label) || store.includes(label));
});

test('le manifeste expose le raccourci vers les 20 espaces', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, 'Quotidien Life OS');
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url === './?lifeos=1'));
});
